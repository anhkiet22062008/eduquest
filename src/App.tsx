import { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  where, 
  doc, 
  getDoc, 
  setDoc, 
  getDocs,
  addDoc 
} from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { db, auth } from './firebase';
import { UserProfile, KnowledgeItem, Subject, UserRole } from './types';
import Navbar from './components/Navbar';
import SearchHero from './components/SearchHero';
import SubjectFilter from './components/SubjectFilter';
import KnowledgeCard from './components/KnowledgeCard';
import KnowledgeDetail from './components/KnowledgeDetail';
import AdminDashboard from './components/AdminDashboard';
import Pagination from './components/Pagination';
import BookmarkList from './components/BookmarkList';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Search, Filter, Plus, User as UserIcon, LogIn, LogOut, LayoutDashboard, Bookmark, MessageSquare } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKnowledge, setSelectedKnowledge] = useState<KnowledgeItem | null>(null);
  const [view, setView] = useState<'home' | 'admin' | 'bookmarks'>('home');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const homeLimit = 6;

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const docRef = doc(db, 'users', u.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        } else {
          // Create student profile by default
          const newProfile: UserProfile = {
            uid: u.uid,
            email: u.email || '',
            role: 'student',
            displayName: u.displayName || 'Học sinh'
          };
          // Check if default admin
          if (u.email === 'anhvinhktu2020@gmail.com') {
            newProfile.role = 'admin';
          }
          await setDoc(docRef, newProfile);
          setProfile(newProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Knowledge listener
  useEffect(() => {
    const q = query(collection(db, 'knowledge'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as KnowledgeItem));
      setKnowledge(items);
    });
    return unsubscribe;
  }, []);

  // Subjects listener
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'subjects'), (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));
      
      if (items.length === 0) {
        // Seed default subjects only if collection is empty
        const defaultSubjects = [
          { name: 'Toán học', icon: 'Calculator' },
          { name: 'Vật lý', icon: 'Zap' },
          { name: 'Hóa học', icon: 'FlaskConical' },
          { name: 'Sinh học', icon: 'Dna' },
          { name: 'Ngữ văn', icon: 'PenTool' },
          { name: 'Tiếng Anh', icon: 'Languages' },
          { name: 'Lịch sử', icon: 'History' },
          { name: 'Địa lý', icon: 'Globe' }
        ];
        defaultSubjects.forEach(s => addDoc(collection(db, 'subjects'), s));
      }

      // Deduplicate by name for the UI
      const uniqueItems = items.filter((v, i, a) => 
        a.findIndex(t => t.name === v.name) === i
      );
      setSubjects(uniqueItems);
    });
    return unsubscribe;
  }, []);

  const seedKnowledge = async () => {
    const sample = [
      {
        title: 'Định luật Ôm cho toàn mạch',
        subject: 'Vật lý',
        summary: 'Cường độ dòng điện chạy trong mạch điện kín tỉ lệ thuận với suất điện động của nguồn điện và tỉ lệ nghịch với điện trở toàn phần của mạch đó.\n\n**Công thức:** $I = \\frac{E}{R + r}$',
        example: 'Một nguồn điện có suất điện động 6V, điện trở trong 1Ω nối với điện trở ngoài 2Ω. Tính cường độ dòng điện trong mạch.\n\n$I = 6 / (2 + 1) = 2A$',
        keywords: ['Vật lý', 'Điện học', 'Định luật Ôm'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        title: 'Đạo hàm của hàm số hợp',
        subject: 'Toán học',
        summary: 'Nếu hàm số $u = g(x)$ có đạo hàm tại $x$ là $u\'_x$ và hàm số $y = f(u)$ có đạo hàm tại $u$ là $y\'_u$ thì hàm số hợp $y = f(g(x))$ có đạo hàm tại $x$ là:\n\n$y\'_x = y\'_u \\cdot u\'_x$',
        example: 'Tính đạo hàm của $y = (x^2 + 1)^3$.\n\nĐặt $u = x^2 + 1 \\Rightarrow u\' = 2x$.\n$y = u^3 \\Rightarrow y\' = 3u^2 \\cdot u\' = 3(x^2 + 1)^2 \\cdot 2x = 6x(x^2 + 1)^2$',
        keywords: ['Toán học', 'Giải tích', 'Đạo hàm'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    for (const item of sample) {
      await addDoc(collection(db, 'knowledge'), item);
    }
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error('Login error:', error);
      let message = 'Đã xảy ra lỗi khi đăng nhập.';
      
      if (error.code === 'auth/unauthorized-domain') {
        message = 'Lỗi: Tên miền này chưa được cấp phép trong Firebase Console. \n\nHướng dẫn: \n1. Vào Firebase Console > Authentication > Settings > Authorized Domains. \n2. Thêm tên miền Vercel của bạn vào danh sách.';
      } else if (error.code === 'auth/popup-closed-by-user') {
        message = 'Cửa sổ đăng nhập đã bị đóng.';
      } else if (error.code === 'auth/cancelled-popup-request') {
        message = 'Yêu cầu đăng nhập đã bị hủy.';
      } else if (error.code === 'auth/popup-blocked') {
        message = 'Trình duyệt đã chặn cửa sổ bật lên. Vui lòng cho phép bật lên để đăng nhập.';
      }
      
      alert(message);
    }
  };

  const handleLogout = () => signOut(auth);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedSubject, searchQuery]);

  const filteredKnowledge = knowledge.filter(item => {
    const matchesSubject = !selectedSubject || item.subject === selectedSubject;
    const matchesSearch = !searchQuery || 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.keywords.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSubject && matchesSearch;
  });

  const totalPages = Math.ceil(filteredKnowledge.length / itemsPerPage);
  const displayKnowledge = selectedSubject || searchQuery 
    ? filteredKnowledge.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    : filteredKnowledge.slice(0, homeLimit);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Navbar 
        user={user} 
        profile={profile} 
        onLogin={handleLogin} 
        onLogout={handleLogout} 
        setView={setView}
        currentView={view}
      />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <SearchHero onSearch={setSearchQuery} />
              
              <div className="mt-12 space-y-12">
                <SubjectFilter 
                  subjects={subjects} 
                  selected={selectedSubject} 
                  onSelect={setSelectedSubject} 
                />

                <div className="flex-1">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                      <BookOpen className="w-6 h-6 text-blue-600" />
                      {selectedSubject ? `Kiến thức môn ${selectedSubject}` : 'Tất cả kiến thức'}
                    </h2>
                    <span className="px-4 py-1 bg-slate-100 text-slate-500 text-sm font-medium rounded-full">
                      {filteredKnowledge.length} kết quả
                    </span>
                  </div>

                  {displayKnowledge.length > 0 ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {displayKnowledge.map((item) => (
                          <KnowledgeCard 
                            key={item.id} 
                            item={item} 
                            onClick={() => setSelectedKnowledge(item)} 
                          />
                        ))}
                      </div>
                      
                      {(selectedSubject || searchQuery) && (
                        <Pagination 
                          currentPage={currentPage}
                          totalPages={totalPages}
                          onPageChange={setCurrentPage}
                        />
                      )}

                      {!selectedSubject && !searchQuery && filteredKnowledge.length > homeLimit && (
                        <div className="mt-12 text-center">
                          <button 
                            onClick={() => {
                              // Focus on Math to trigger pagination view if user wants to see more
                              const firstSubject = subjects[0]?.name;
                              if (firstSubject) setSelectedSubject(firstSubject);
                            }}
                            className="px-8 py-3 bg-white border border-slate-200 text-blue-600 font-bold rounded-xl hover:bg-slate-50 transition-all shadow-sm"
                          >
                            Xem thêm kiến thức
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 shadow-sm">
                      <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500 font-medium">Không tìm thấy kiến thức nào phù hợp.</p>
                      <button 
                        onClick={() => {setSearchQuery(''); setSelectedSubject(null);}}
                        className="mt-4 text-blue-600 font-bold hover:underline"
                      >
                        Xóa bộ lọc
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {view === 'admin' && profile?.role === 'admin' && (
            <motion.div
              key="admin"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="mb-6 flex justify-end">
                <button 
                  onClick={seedKnowledge}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200"
                >
                  Seed Sample Data
                </button>
              </div>
              <AdminDashboard subjects={subjects} />
            </motion.div>
          )}

          {view === 'bookmarks' && (
            <motion.div
              key="bookmarks"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="py-12">
                <div className="flex items-center gap-4 mb-10">
                  <div className="p-3 bg-blue-100 rounded-2xl text-blue-600">
                    <Bookmark className="w-8 h-8" fill="currentColor" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-slate-800">Bộ sưu tập của bạn</h2>
                    <p className="text-slate-500">Các kiến thức bạn đã lưu để ôn tập</p>
                  </div>
                </div>
                
                {user ? (
                  (() => {
                    // This is a bit inefficient for big data but okay for prototypes
                    // Usually we'd fetch bookmarks first then their products
                    // But we have all knowledge in memory already
                    const bookmarkedItems: KnowledgeItem[] = [];
                    // We need to fetch bookmarks for current user
                    // Let's add a state for user bookmarks in App.tsx if possible
                    // Or fetch them here.
                    return (
                      <BookmarkList 
                        user={user} 
                        knowledge={knowledge} 
                        onSelect={setSelectedKnowledge} 
                      />
                    );
                  })()
                ) : (
                  <div className="text-center py-20 bg-white rounded-3xl border border-slate-200">
                    <LogIn className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">Vui lòng đăng nhập để xem bộ sưu tập.</p>
                    <button onClick={handleLogin} className="mt-4 text-blue-600 font-bold">Đăng nhập ngay</button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {selectedKnowledge && (
          <KnowledgeDetail 
            item={selectedKnowledge} 
            onClose={() => setSelectedKnowledge(null)} 
            allKnowledge={knowledge}
            user={user}
          />
        )}
      </AnimatePresence>

      <footer className="bg-white border-t border-slate-200 py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <BookOpen className="w-6 h-6 text-blue-600" />
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              EduQuest 12
            </span>
          </div>
          <p className="text-slate-500 text-sm">
            &copy; 2026 EduQuest 12. Nền tảng tra cứu kiến thức cho học sinh lớp 12.
          </p>
        </div>
      </footer>
    </div>
  );
}
