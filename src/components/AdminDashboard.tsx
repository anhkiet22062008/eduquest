import { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  query,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db, storage, handleFirestoreError, OperationType } from '../firebase';
import { Subject, KnowledgeItem, UserProfile } from '../types';
import { Plus, Edit2, Trash2, Save, X, BookOpen, Tag, Image as ImageIcon, Lightbulb, Layers, Upload, Loader2, Users as UsersIcon, Shield, ShieldCheck, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

interface AdminDashboardProps {
  subjects: Subject[];
}

export default function AdminDashboard({ subjects }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'knowledge' | 'subjects' | 'users'>('knowledge');
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<KnowledgeItem>>({
    title: '',
    subject: '',
    summary: '',
    example: '',
    keywords: [],
    image_url: ''
  });
  const [keywordInput, setKeywordInput] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'knowledge'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setKnowledge(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as KnowledgeItem)));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (activeTab === 'users') {
      const q = query(collection(db, 'users'), orderBy('email'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setUsersList(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
      });
      return unsubscribe;
    }
  }, [activeTab]);

  const handleSave = async () => {
    if (!formData.title || !formData.subject || !formData.summary) {
      alert('Vui lòng điền đầy đủ các trường bắt buộc!');
      return;
    }

    try {
      const data = {
        ...formData,
        updatedAt: new Date().toISOString(),
        createdAt: formData.createdAt || new Date().toISOString(),
      };

      if (isEditing) {
        await updateDoc(doc(db, 'knowledge', isEditing), data);
      } else {
        await addDoc(collection(db, 'knowledge'), data);
      }
      
      resetForm();
    } catch (error) {
      handleFirestoreError(error, isEditing ? OperationType.UPDATE : OperationType.CREATE, `knowledge/${isEditing || ''}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa kiến thức này?')) {
      try {
        await deleteDoc(doc(db, 'knowledge', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `knowledge/${id}`);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      subject: '',
      summary: '',
      example: '',
      keywords: [],
      image_url: ''
    });
    setIsEditing(null);
    setKeywordInput('');
  };

  const addKeyword = () => {
    if (keywordInput.trim() && !formData.keywords?.includes(keywordInput.trim())) {
      setFormData({
        ...formData,
        keywords: [...(formData.keywords || []), keywordInput.trim()]
      });
      setKeywordInput('');
    }
  };

  const removeKeyword = (kw: string) => {
    setFormData({
      ...formData,
      keywords: formData.keywords?.filter(k => k !== kw)
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn một file hình ảnh!');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Dung lượng ảnh không được vượt quá 5MB!');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    const storageRef = ref(storage, `knowledge/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      (error) => {
        console.error('Upload error:', error);
        let message = 'Lỗi khi tải ảnh lên.';
        if (error.code === 'storage/unauthorized') {
          message = 'Lỗi: Bạn không có quyền tải ảnh lên. Vui lòng kiểm tra Security Rules trong Firebase Storage.';
        } else if (error.code === 'storage/canceled') {
          message = 'Tải lên đã bị hủy.';
        } else if (error.code === 'storage/unknown') {
          message = 'Lỗi không xác định. Vui lòng kiểm tra xem bạn đã kích hoạt Firebase Storage trong Console chưa.';
        }
        alert(`${message} (Mã lỗi: ${error.code})`);
        setIsUploading(false);
        setUploadProgress(null);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        setFormData(prev => ({ ...prev, image_url: downloadURL }));
        setIsUploading(false);
        setUploadProgress(null);
      }
    );
  };

  const toggleUserRole = async (user: UserProfile) => {
    if (user.email === 'anhvinhktu2020@gmail.com') {
      alert('Không thể thay đổi quyền của Admin mặc định!');
      return;
    }

    const newRole = user.role === 'admin' ? 'student' : 'admin';
    if (confirm(`Thay đổi quyền truy cập của ${user.email} thành ${newRole}?`)) {
      const path = `users/${user.uid}`;
      try {
        await updateDoc(doc(db, 'users', user.uid), { role: newRole });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-extrabold text-slate-900">Bảng quản trị</h2>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('knowledge')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'knowledge' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Kiến thức
          </button>
          <button 
            onClick={() => setActiveTab('subjects')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'subjects' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Môn học
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'users' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Thành viên
          </button>
        </div>
      </div>

      {activeTab === 'knowledge' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm sticky top-24">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                {isEditing ? <Edit2 className="w-5 h-5 text-amber-500" /> : <Plus className="w-5 h-5 text-blue-600" />}
                {isEditing ? 'Chỉnh sửa kiến thức' : 'Thêm kiến thức mới'}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tiêu đề *</label>
                  <input 
                    type="text" 
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    placeholder="VD: Định luật Ôm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Môn học *</label>
                  <select 
                    value={formData.subject}
                    onChange={e => setFormData({...formData, subject: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  >
                    <option value="">Chọn môn học</option>
                    {subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tóm tắt lý thuyết *</label>
                  <textarea 
                    value={formData.summary}
                    onChange={e => setFormData({...formData, summary: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all h-32 resize-none"
                    placeholder="Nhập nội dung lý thuyết (hỗ trợ Markdown & LaTeX)..."
                  />
                  {formData.summary && (
                    <div className="mt-2 p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-xs">
                      <p className="text-[10px] font-bold text-blue-400 uppercase mb-1">Xem trước:</p>
                      <div className="prose prose-slate max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                          {formData.summary}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ví dụ minh họa</label>
                  <textarea 
                    value={formData.example}
                    onChange={e => setFormData({...formData, example: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all h-24 resize-none"
                    placeholder="Nhập ví dụ minh họa..."
                  />
                  {formData.example && (
                    <div className="mt-2 p-3 bg-amber-50/50 rounded-xl border border-amber-100 text-xs">
                      <p className="text-[10px] font-bold text-amber-400 uppercase mb-1">Xem trước:</p>
                      <div className="italic">
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                          {formData.example}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hình ảnh minh họa</label>
                  <div className="space-y-3">
                    {formData.image_url ? (
                      <div className="relative rounded-xl overflow-hidden border border-slate-200 group">
                        <img 
                          src={formData.image_url} 
                          alt="Preview" 
                          className="w-full h-32 object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <button 
                          onClick={() => setFormData(prev => ({ ...prev, image_url: '' }))}
                          className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 hover:border-blue-300 transition-all group">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          {isUploading ? (
                            <div className="flex flex-col items-center gap-2">
                              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                              <p className="text-xs text-slate-500 font-medium">Đang tải lên {Math.round(uploadProgress || 0)}%</p>
                            </div>
                          ) : (
                            <>
                              <Upload className="w-8 h-8 text-slate-400 group-hover:text-blue-500 mb-2 transition-colors" />
                              <p className="text-xs text-slate-500 font-medium">Nhấn để tải ảnh lên</p>
                              <p className="text-[10px] text-slate-400 mt-1">PNG, JPG (Tối đa 5MB)</p>
                            </>
                          )}
                        </div>
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*"
                          onChange={handleImageUpload}
                          disabled={isUploading}
                        />
                      </label>
                    )}
                    
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <ImageIcon className="h-4 w-4 text-slate-400" />
                      </div>
                      <input 
                        type="text" 
                        value={formData.image_url}
                        onChange={e => setFormData({...formData, image_url: e.target.value})}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm"
                        placeholder="Hoặc dán URL hình ảnh tại đây..."
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Từ khóa</label>
                  <div className="flex gap-2 mb-2">
                    <input 
                      type="text" 
                      value={keywordInput}
                      onChange={e => setKeywordInput(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && addKeyword()}
                      className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                      placeholder="Thêm từ khóa..."
                    />
                    <button 
                      onClick={addKeyword}
                      className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.keywords?.map(kw => (
                      <span key={kw} className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 text-xs font-medium rounded-lg">
                        {kw}
                        <button onClick={() => removeKeyword(kw)} className="hover:text-red-500">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={handleSave}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Lưu lại
                  </button>
                  {isEditing && (
                    <button 
                      onClick={resetForm}
                      className="px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                    >
                      Hủy
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-bold text-slate-800">Danh sách kiến thức</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {knowledge.map(item => (
                  <div key={item.id} className="p-6 hover:bg-slate-50 transition-colors flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded uppercase">
                          {item.subject}
                        </span>
                        <h4 className="font-bold text-slate-800">{item.title}</h4>
                      </div>
                      <div className="text-sm text-slate-500 line-clamp-1 mb-2">
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                          {item.summary}
                        </ReactMarkdown>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {item.keywords.map((kw, i) => (
                          <span key={i} className="text-[10px] text-slate-400">#{kw}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          setIsEditing(item.id);
                          setFormData(item);
                        }}
                        className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {knowledge.length === 0 && (
                  <div className="p-12 text-center text-slate-400">
                    Chưa có kiến thức nào. Hãy thêm kiến thức đầu tiên!
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'subjects' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Layers className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-800 mb-2">Quản lý môn học</h3>
          <p className="text-slate-500">Tính năng đang được phát triển...</p>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <UsersIcon className="w-5 h-5 text-blue-600" />
              Quản lý thành viên ({usersList.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                  <th className="px-6 py-4">Thành viên</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Quyền hạn</th>
                  <th className="px-6 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usersList.map((u) => (
                  <tr key={u.uid} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                          {u.displayName.charAt(0)}
                        </div>
                        <span className="font-bold text-slate-800">{u.displayName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-sm">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                        u.role === 'admin' 
                          ? 'bg-amber-100 text-amber-700' 
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {u.role === 'admin' ? <ShieldCheck className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                        {u.role === 'admin' ? 'Quản trị viên' : 'Học sinh'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => toggleUserRole(u)}
                        disabled={u.email === 'anhvinhktu2020@gmail.com'}
                        className={`text-xs font-bold px-4 py-2 rounded-xl transition-all ${
                          u.email === 'anhvinhktu2020@gmail.com'
                          ? 'opacity-0 cursor-default'
                          : u.role === 'admin'
                            ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            : 'bg-amber-500 text-white hover:bg-amber-600 shadow-md shadow-amber-200'
                        }`}
                      >
                        {u.role === 'admin' ? 'Hạ quyền' : 'Cấp quyền Admin'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
