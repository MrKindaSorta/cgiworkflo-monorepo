import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAAR } from '../contexts/AARContext';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, Eye, ArrowLeft, MessageCircle } from 'lucide-react';
import { displayArea, displayLiquid } from '../utils/units';

const AARDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { getAAR, incrementViews, upvoteAAR, downvoteAAR, addComment } = useAAR();
  const { currentUser } = useAuth();
  const [aar, setAAR] = useState(null);
  const [comment, setComment] = useState('');

  useEffect(() => {
    const loadAAR = async () => {
      const aarData = await getAAR(id);
      if (aarData) {
        setAAR(aarData.aar);  // Extract the aar object from { aar, photos }
        incrementViews(id);
      }
    };
    loadAAR();
  }, [id]);

  const handleUpvote = () => {
    upvoteAAR(id);
    setAAR({ ...aar, upvotes: aar.upvotes + 1 });
  };

  const handleDownvote = () => {
    downvoteAAR(id);
    setAAR({ ...aar, downvotes: aar.downvotes + 1 });
  };

  const handleAddComment = (e) => {
    e.preventDefault();
    if (comment.trim()) {
      addComment(id, {
        userId: currentUser.id,
        userName: currentUser.name,
        content: comment,
      });
      setComment('');
      setAAR({ ...aar, comments: [...(aar.comments || []), { content: comment }] });
    }
  };

  if (!aar) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500 dark:text-gray-400">AAR not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
      >
        <ArrowLeft className="w-5 h-5 mr-2" />
        Back
      </button>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
            {aar.category} - {aar.subCategory} {aar.model}
          </h1>
          <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
            <span>{aar.year}</span>
            <span>•</span>
            <span>{aar.color}</span>
            <span>•</span>
            <span>{aar.material}</span>
            <span>•</span>
            <span className="flex items-center">
              <Eye className="w-4 h-4 mr-1" />
              {aar.views || 0}
            </span>
          </div>
        </div>

        {/* Photos */}
        {aar.photos && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 bg-gray-50 dark:bg-gray-900/50">
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('aar.before')}
              </h3>
              <div className="aspect-video bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
                {aar.photos.before?.[0] && (
                  <img
                    src={aar.photos.before[0]}
                    alt="Before"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('aar.after')}
              </h3>
              <div className="aspect-video bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
                {aar.photos.after?.[0] && (
                  <img
                    src={aar.photos.after[0]}
                    alt="After"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Details */}
        <div className="p-6 space-y-4 md:space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Damage Information
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Damage Type:</span>
                <span className="ml-2 text-gray-900 dark:text-white">{aar.damageType}</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Job Type:</span>
                <span className="ml-2 text-gray-900 dark:text-white">{aar.jobType}</span>
              </div>
            </div>
            <p className="text-gray-900 dark:text-white mt-2">{aar.damageDescription}</p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Repair Process
            </h3>
            <p className="text-gray-900 dark:text-white whitespace-pre-line">
              {aar.processDescription}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400 block">Repair Time</span>
              <span className="text-gray-900 dark:text-white">{aar.repairTime} hours</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400 block">Area</span>
              <span className="text-gray-900 dark:text-white">{displayArea(aar.area)}</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400 block">Liquid Used</span>
              <span className="text-gray-900 dark:text-white">{displayLiquid(aar.liquid)}</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400 block">Cost</span>
              <span className="text-gray-900 dark:text-white">${aar.cost}</span>
            </div>
          </div>

          {aar.paintDyeMix && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Paint/Dye Mix
              </h3>
              <p className="text-gray-900 dark:text-white">{aar.paintDyeMix}</p>
            </div>
          )}

          {aar.toolsUsed && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Tools Used
              </h3>
              <div className="flex flex-wrap gap-2">
                {aar.toolsUsed.map((tool, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Voting */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleUpvote}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
            >
              <ThumbsUp className="w-5 h-5" />
              <span>{aar.upvotes}</span>
            </button>
            <button
              onClick={handleDownvote}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            >
              <ThumbsDown className="w-5 h-5" />
              <span>{aar.downvotes}</span>
            </button>
          </div>
        </div>

        {/* Comments */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {t('aar.comments')}
          </h3>

          <form onSubmit={handleAddComment} className="mb-6">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment..."
              rows={3}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            />
            <button
              type="submit"
              className="mt-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium transition-colors"
            >
              Add Comment
            </button>
          </form>

          <div className="space-y-4">
            {aar.comments && aar.comments.length > 0 ? (
              aar.comments.map((comment, index) => (
                <div key={index} className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {comment.userName}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(comment.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300">{comment.content}</p>
                </div>
              ))
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                No comments yet. Be the first to comment!
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AARDetail;
