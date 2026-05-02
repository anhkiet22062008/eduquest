import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { User } from 'firebase/auth';
import { KnowledgeItem } from '../types';
import KnowledgeCard from './KnowledgeCard';
import { BookOpen } from 'lucide-react';

interface BookmarkListProps {
  user: User;
  knowledge: KnowledgeItem[];
  onSelect: (item: KnowledgeItem) => void;
}

export default function BookmarkList({ user, knowledge, onSelect }: BookmarkListProps) {
  const [bookmarkIds, setBookmarkIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'bookmarks'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBookmarkIds(snapshot.docs.map(doc => doc.data().knowledgeId));
      setLoading(false);
    });
    return unsubscribe;
  }, [user.uid]);

  const bookmarkedItems = knowledge.filter(item => bookmarkIds.includes(item.id));

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (bookmarkedItems.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-3xl border border-slate-200">
        <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500">Bạn chưa lưu kiến thức nào.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {bookmarkedItems.map((item) => (
        <KnowledgeCard 
          key={item.id} 
          item={item} 
          onClick={() => onSelect(item)} 
        />
      ))}
    </div>
  );
}
