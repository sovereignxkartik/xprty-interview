import { CandidateProfile, InterviewerProfile, User, UserRole } from '../types';
import bcrypt from 'bcryptjs';
import { db } from './database.service';
import { isSupabaseConfigured, supabase, supabaseAuth } from './supabase.service';

type Registration = {
  email: string;
  full_name: string;
  role: Exclude<UserRole, 'super_admin'>;
  password: string;
  password_hash?: string;
  organization?: string;
  title?: string;
  skills?: string[];
  phone?: string;
  resume_url?: string;
  portfolio_url?: string;
};

function asUser(row: any): User {
  return { ...row, password_hash: row.password_hash || '', created_at: new Date(row.created_at).toISOString() } as User;
}

function organizationSlug(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 90) || 'organization';
}

function databaseAccessError(error: any, action: string): Error {
  if (error?.code === '42501') {
    return new Error('Database permissions are incomplete. Apply the Supabase migration 20261115_grant_service_role_access.sql, then restart the API.');
  }
  return new Error(action);
}

function mirrorUser(user: User) {
  if (!db.getUserById(user.id)) {
    db.createUserWithId(user);
  } else {
    db.updateUser(user.id, user);
  }
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  if (!isSupabaseConfigured || !supabase) return db.getUserByEmail(email);
  const { data, error } = await supabase.from('profiles').select('*').ilike('email', email.trim()).maybeSingle();
  if (error) throw databaseAccessError(error, 'Unable to look up the account.');
  if (!data) return undefined;
  const user = asUser(data);
  mirrorUser(user);
  return user;
}

export async function findUserById(id: string): Promise<User | undefined> {
  if (!isSupabaseConfigured || !supabase) return db.getUserById(id);
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  if (error) throw databaseAccessError(error, 'Unable to validate the account.');
  if (!data) return undefined;
  const user = asUser(data);
  mirrorUser(user);
  return user;
}

export async function registerUser(input: Registration): Promise<User> {
  if (!isSupabaseConfigured || !supabase) {
    const user = db.createUser({ email: input.email, full_name: input.full_name, role: input.role, password_hash: input.password_hash || '', is_active: true });
    createLocalProfile(user, input);
    return user;
  }
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: input.email.trim().toLowerCase(), password: input.password, email_confirm: true,
    user_metadata: { full_name: input.full_name.trim() }
  });
  if (authError || !authData.user) throw new Error(authError?.message === 'User already registered' ? 'An account with this email already exists.' : 'Unable to create the authentication account.');
  // The auth.users trigger creates the candidate profile. Promotion and any
  // organization records are performed only by this server-side service-role client.
  const { data, error } = await supabase.from('profiles').update({
    email: input.email.trim().toLowerCase(), full_name: input.full_name.trim(), role: input.role, is_active: true
  }).eq('id', authData.user.id).select('*').single();
  if (error) {
    await supabase.auth.admin.deleteUser(authData.user.id);
    if (error.code === '23505') throw new Error('An account with this email already exists.');
    throw new Error('Unable to create the account.');
  }
  const user = asUser(data);
  let profileError: any = null;
  if (input.role === 'interviewer') {
    const organizationName = input.organization?.trim() || 'Independent Organization';
    const slug = organizationSlug(organizationName);
    let { data: organization } = await supabase.from('organizations').select('id').eq('slug', slug).maybeSingle();
    if (!organization) {
      const created = await supabase.from('organizations').insert({ name: organizationName, slug }).select('id').single();
      organization = created.data;
      profileError = created.error;
    }
    if (!profileError && organization) {
      const membership = await supabase.from('organization_members').upsert({ organization_id: organization.id, user_id: user.id, role: 'interviewer' });
      const interviewer = await supabase.from('interviewer_profiles').upsert({ user_id: user.id, organization_id: organization.id, title: input.title || 'Technical Interviewer', skills: input.skills || [], verification_status: 'verified' });
      await supabase.from('candidate_profiles').delete().eq('user_id', user.id);
      profileError = membership.error || interviewer.error;
    }
  } else {
    const candidate = await supabase.from('candidate_profiles').update({
      phone: input.phone || null,
      resume_url: input.resume_url || null,
      portfolio_url: input.portfolio_url || null,
      skills: input.skills || []
    }).eq('user_id', user.id);
    profileError = candidate.error;
  }
  if (profileError) {
    await supabase.auth.admin.deleteUser(authData.user.id);
    throw new Error('Unable to create the account profile.');
  }
  mirrorUser(user);
  createLocalProfile(user, input);
  return user;
}

export async function authenticateUser(email: string, password: string): Promise<User | undefined> {
  if (!isSupabaseConfigured || !supabaseAuth) {
    const user = db.getUserByEmail(email);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) return undefined;
    return user;
  }
  const { data, error } = await supabaseAuth.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error || !data.user) return undefined;
  return findUserById(data.user.id);
}

function createLocalProfile(user: User, input: Registration) {
  if (user.role === 'interviewer') {
    const profile: InterviewerProfile = { id: `prof_int_${user.id}`, user_id: user.id, organization_name: input.organization || 'Independent Organization', title: input.title || 'Technical Interviewer', verification_status: 'verified', total_interviews_conducted: 0, is_busy: false, current_active_session_id: null, created_at: new Date().toISOString() };
    db.setInterviewerProfile(profile);
  } else {
    const profile: CandidateProfile = { id: `prof_cand_${user.id}`, user_id: user.id, phone: input.phone || '', skills: input.skills || [], created_at: new Date().toISOString() };
    db.setCandidateProfile(profile);
  }
}

export async function getProfile(user: User): Promise<InterviewerProfile | CandidateProfile | null> {
  if (!isSupabaseConfigured || !supabase) return user.role === 'interviewer' ? db.getInterviewerProfile(user.id) || null : db.getCandidateProfile(user.id) || null;
  if (user.role === 'interviewer') {
    const { data, error } = await supabase.from('interviewer_profiles').select('*').eq('user_id', user.id).maybeSingle();
    if (error) throw new Error('Unable to load the account profile.');
    if (!data) return null;
    const { data: organization } = await supabase.from('organizations').select('name').eq('id', data.organization_id).maybeSingle();
    return { ...data, organization_name: organization?.name || 'Organization' } as InterviewerProfile;
  }
  const { data, error } = await supabase.from('candidate_profiles').select('*').eq('user_id', user.id).maybeSingle();
  if (error) throw new Error('Unable to load the account profile.');
  return data as CandidateProfile | null;
}
