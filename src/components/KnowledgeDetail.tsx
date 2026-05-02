import { useEffect, useState } from 'react';
import { KnowledgeItem, Bookmark as BookmarkType } from '../types';
import { motion } from 'motion/react';
import { X, Tag, BookOpen, Lightbulb, Share2, Bookmark, MessageSquare, ArrowRight, Loader2, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { User } from 'firebase/auth';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

interface KnowledgeDetailProps {
  item: KnowledgeItem;
  onClose: () => void;
  allKnowledge: KnowledgeItem[];
  user: User | null;
}

export default function KnowledgeDetail({ item, onClose, allKnowledge, user }: KnowledgeDetailProps) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkId, setBookmarkId] = useState<string | null>(null);
  const [loadingBookmark, setLoadingBookmark] = useState(false);
  const [isReporting, setIsReporting] = useState(false);

  // Find related knowledge based on shared keywords
  const related = allKnowledge
    .filter(k => k.id !== item.id && k.keywords.some(kw => item.keywords.includes(kw)))
    .slice(0, 3);

  useEffect(() => {
    if (!user) {
      setIsBookmarked(false);
      setBookmarkId(null);
      return;
    }

    const q = query(
      collection(db, 'bookmarks'), 
      where('userId', '==', user.uid), 
      where('knowledgeId', '==', item.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setIsBookmarked(true);
        setBookmarkId(snapshot.docs[0].id);
      } else {
        setIsBookmarked(false);
        setBookmarkId(null);
      }
    });

    return unsubscribe;
  }, [user, item.id]);

  const handleShare = async () => {
    const shareData = {
      title: 'EduQuest 12 - ' + item.title,
      text: item.summary.substring(0, 100) + '...',
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert('Đã sao chép liên kết vào bộ nhớ tạm!');
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  const toggleBookmark = async () => {
    if (!user) {
      alert('Vui lòng đăng nhập để lưu kiến thức!');
      return;
    }

    setLoadingBookmark(true);
    try {
      if (isBookmarked && bookmarkId) {
        await deleteDoc(doc(db, 'bookmarks', bookmarkId));
      } else {
        const path = 'bookmarks';
        await addDoc(collection(db, path), {
          userId: user.uid,
          knowledgeId: item.id,
          createdAt: new Date().toISOString()
        });
      }
    } catch (err) {
      handleFirestoreError(err, isBookmarked ? OperationType.DELETE : OperationType.CREATE, `bookmarks/${bookmarkId || ''}`);
    } finally {
      setLoadingBookmark(false);
    }
  };

  const handleReport = async () => {
    if (!user) {
      alert('Vui lòng đăng nhập để gửi báo cáo!');
      return;
    }

    const content = prompt('Nhập nội dung báo cáo hoặc góp ý của bạn:');
    if (!content || content.trim() === '') return;

    setIsReporting(true);
    const path = 'feedback';
    try {
      await addDoc(collection(db, path), {
        userId: user.uid,
        knowledgeId: item.id,
        content: content.trim(),
        createdAt: new Date().toISOString()
      });
      alert('Cảm ơn bạn! Báo cáo của bạn đã được gửi đến ban quản trị.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    } finally {
      setIsReporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-100 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full uppercase tracking-wider">
              {item.subject}
            </span>
            <span className="text-sm text-slate-400 hidden sm:block">
              Cập nhật: {new Date(item.updatedAt).toLocaleDateString('vi-VN')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleShare}
              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
              title="Chia sẻ"
            >
              <Share2 className="w-5 h-5" />
            </button>
            <button 
              onClick={toggleBookmark}
              disabled={loadingBookmark}
              className={`p-2 rounded-full transition-colors ${
                isBookmarked 
                  ? 'text-blue-600 bg-blue-50' 
                  : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'
              }`}
              title={isBookmarked ? 'Bỏ lưu' : 'Lưu kiến thức'}
            >
              {loadingBookmark ? <Loader2 className="w-5 h-5 animate-spin" /> : <Bookmark className="w-5 h-5" fill={isBookmarked ? 'currentColor' : 'none'} />}
            </button>
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-6 sm:p-10">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-8 leading-tight">
            {item.title}
          </h1>

          {item.image_url && (
            <div className="mb-10 rounded-2xl overflow-hidden border border-slate-200 shadow-lg">
              <img 
                src={item.image_url} 
                alt={item.title} 
                className="w-full h-auto object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 space-y-10">
              <section>
                <div className="flex items-center gap-2 mb-4 text-blue-600">
                  <BookOpen className="w-6 h-6" />
                  <h2 className="text-xl font-bold">Tóm tắt lý thuyết</h2>
                </div>
                <div className="prose prose-slate max-w-none bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {item.summary}
                  </ReactMarkdown>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-4 text-amber-500">
                  <Lightbulb className="w-6 h-6" />
                  <h2 className="text-xl font-bold">Ví dụ minh họa</h2>
                </div>
                <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 text-slate-800 italic">
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {item.example}
                  </ReactMarkdown>
                </div>
              </section>

              <section className="pt-10 border-t border-slate-100">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-slate-800">Kiến thức liên quan</h3>
                </div>
                {related.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {related.map(rel => (
                      <div 
                        key={rel.id}
                        className="p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
                      >
                        <span className="font-medium text-slate-700 group-hover:text-blue-600 transition-colors truncate pr-4">
                          {rel.title}
                        </span>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-all" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm italic">Không có kiến thức liên quan nào được tìm thấy.</p>
                )}
              </section>
            </div>

            <div className="space-y-8">
              <section className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-blue-600" />
                  Từ khóa
                </h3>
                <div className="flex flex-wrap gap-2">
                  {item.keywords.map((kw, i) => (
                    <span key={i} className="px-3 py-1 bg-white border border-slate-200 text-slate-600 text-xs font-medium rounded-lg">
                      {kw}
                    </span>
                  ))}
                </div>
              </section>

              <section className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                <h3 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Phản hồi
                </h3>
                <p className="text-blue-700 text-sm mb-4">
                  Bạn thấy kiến thức này có ích không? Hãy gửi báo cáo nếu có sai sót.
                </p>
                <button 
                  onClick={handleReport}
                  disabled={isReporting}
                  className="w-full py-2 bg-white text-blue-600 rounded-xl text-sm font-bold hover:bg-blue-100 transition-colors border border-blue-200 shadow-sm flex items-center justify-center gap-2"
                >
                  {isReporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                  Gửi báo cáo
                </button>
              </section>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
