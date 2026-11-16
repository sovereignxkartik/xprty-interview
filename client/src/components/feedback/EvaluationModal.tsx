import React, { useState } from 'react';
import { Star, Award, ThumbsUp, ThumbsDown, Send } from 'lucide-react';

interface EvaluationModalProps {
  sessionId: string;
  interviewerId: string;
  candidateName: string;
  existingFeedback?: any;
  onSubmit: (feedback: any) => Promise<void>;
  onClose: () => void;
}

export const EvaluationModal: React.FC<EvaluationModalProps> = ({
  sessionId,
  interviewerId,
  candidateName,
  onSubmit,
  onClose,
  existingFeedback
}) => {
  const [technical, setTechnical] = useState(existingFeedback?.technical_score || 4);
  const [problemSolving, setProblemSolving] = useState(existingFeedback?.problem_solving_score || 4);
  const [communication, setCommunication] = useState(existingFeedback?.communication_score || 4);
  const [overall, setOverall] = useState(existingFeedback?.overall_rating || 4);
  const [recommendation, setRecommendation] = useState<'strong_hire' | 'hire' | 'neutral' | 'reject'>(existingFeedback?.recommendation || 'hire');
  const [summary, setSummary] = useState(existingFeedback?.summary_notes || '');
  const [strengths, setStrengths] = useState(existingFeedback?.detailed_scores?.strengths || '');
  const [improvements, setImprovements] = useState(existingFeedback?.detailed_scores?.improvements || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit({
        sessionId,
        interviewer_id: interviewerId,
        technical_score: technical,
        problem_solving_score: problemSolving,
        communication_score: communication,
        overall_rating: overall,
        recommendation,
        summary_notes: summary,
        strengths,
        improvements
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStars = (value: number, setter: (val: number) => void) => (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => setter(star)}
          className={`p-1 rounded transition-colors ${
            star <= value ? 'text-[#DB7A57]' : 'text-[#32302D] hover:text-[#ABA7A2]'
          }`}
        >
          <Star className="w-5 h-5 fill-current" />
        </button>
      ))}
      <span className="text-xs font-mono ml-2 text-[#CBC3B9]">{value}/5</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-[#110F0E]/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-[#191715] border border-[#32302D] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-6 border-b border-[#32302D] bg-[#110F0E] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#DB7A57]/15 text-[#DB7A57] border border-[#DB7A57]/30">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-serif text-[#F4F2EB]">Structured Candidate Evaluation</h2>
              <p className="text-xs text-[#ABA7A2]">Assessment scorecard for {candidateName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#ABA7A2] hover:text-[#F4F2EB] text-sm">
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Competency Ratings */}
          <div className="space-y-3 bg-[#110F0E] p-4 rounded-2xl border border-[#32302D]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#CBC3B9]">Technical Competency & Architecture</span>
              {renderStars(technical, setTechnical)}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#CBC3B9]">Problem Solving & Execution</span>
              {renderStars(problemSolving, setProblemSolving)}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#CBC3B9]">Communication & Articulation</span>
              {renderStars(communication, setCommunication)}
            </div>
            <div className="pt-2 border-t border-[#32302D] flex items-center justify-between">
              <span className="text-xs font-bold text-[#DB7A57]">Overall Candidate Score</span>
              {renderStars(overall, setOverall)}
            </div>
          </div>

          {/* Hiring Recommendation */}
          <div>
            <label className="block text-xs font-semibold text-[#CBC3B9] mb-2">Recommendation</label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setRecommendation('strong_hire')}
                className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-semibold transition-all duration-300 ${
                  recommendation === 'strong_hire'
                    ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500 shadow-md'
                    : 'bg-[#211E1C] text-[#ABA7A2] border-[#32302D] hover:border-[#ABA7A2]'
                }`}
              >
                <Award className="w-4 h-4 text-emerald-400" />
                <span>Strong Hire</span>
              </button>

              <button
                type="button"
                onClick={() => setRecommendation('hire')}
                className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-semibold transition-all duration-300 ${
                  recommendation === 'hire'
                    ? 'bg-[#DB7A57]/20 text-[#DB7A57] border-[#DB7A57] shadow-md'
                    : 'bg-[#211E1C] text-[#ABA7A2] border-[#32302D] hover:border-[#ABA7A2]'
                }`}
              >
                <ThumbsUp className="w-4 h-4 text-[#DB7A57]" />
                <span>Hire</span>
              </button>

              <button
                type="button"
                onClick={() => setRecommendation('neutral')}
                className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-semibold transition-all duration-300 ${
                  recommendation === 'neutral'
                    ? 'bg-amber-950/80 text-amber-400 border-amber-500'
                    : 'bg-[#211E1C] text-[#ABA7A2] border-[#32302D] hover:border-[#ABA7A2]'
                }`}
              >
                <span>Neutral</span>
              </button>

              <button
                type="button"
                onClick={() => setRecommendation('reject')}
                className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-semibold transition-all duration-300 ${
                  recommendation === 'reject'
                    ? 'bg-rose-950/80 text-rose-400 border-rose-500'
                    : 'bg-[#211E1C] text-[#ABA7A2] border-[#32302D] hover:border-[#ABA7A2]'
                }`}
              >
                <ThumbsDown className="w-4 h-4 text-rose-400" />
                <span>Do Not Hire</span>
              </button>
            </div>
          </div>

          {/* Feedback Texts */}
          <div>
            <label className="block text-xs font-semibold text-[#CBC3B9] mb-1.5">Executive Summary</label>
            <textarea
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Candidate demonstrated deep architectural intuition with distributed queues..."
              className="w-full p-3 rounded-xl bg-[#110F0E] border border-[#32302D] text-xs text-[#F4F2EB] placeholder-[#ABA7A2] focus:outline-none focus:border-[#DB7A57] resize-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#CBC3B9] mb-1.5">Key Strengths</label>
              <textarea
                rows={2}
                value={strengths}
                onChange={(e) => setStrengths(e.target.value)}
                placeholder="High clean code quality, clear communication"
                className="w-full p-2.5 rounded-xl bg-[#110F0E] border border-[#32302D] text-xs text-[#F4F2EB] placeholder-[#ABA7A2] focus:outline-none focus:border-[#DB7A57] resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#CBC3B9] mb-1.5">Areas for Growth</label>
              <textarea
                rows={2}
                value={improvements}
                onChange={(e) => setImprovements(e.target.value)}
                placeholder="Database indexing on high-frequency tables"
                className="w-full p-2.5 rounded-xl bg-[#110F0E] border border-[#32302D] text-xs text-[#F4F2EB] placeholder-[#ABA7A2] focus:outline-none focus:border-[#DB7A57] resize-none"
              />
            </div>
          </div>

          {/* Submit Actions */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-[#32302D] text-xs font-medium text-[#CBC3B9] hover:bg-[#211E1C] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 rounded-full bg-[#DB7A57] hover:bg-[#EA8D69] text-[#110F0E] text-xs font-semibold shadow-glow flex items-center gap-2 transition-all duration-300 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Submitting...' : 'Submit Evaluation'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
