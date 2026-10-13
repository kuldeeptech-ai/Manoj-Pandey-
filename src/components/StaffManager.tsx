import React, { useState } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  Plus,
  Shield,
  ShieldCheck,
  Key,
  Trash2,
  Edit2,
  Check,
  X,
  AlertCircle,
  Eye,
  EyeOff,
  Copy,
  CheckCircle2,
  Lock,
  Sparkles,
  Phone,
  FileText,
  Save,
} from 'lucide-react';
import { StaffUser, StaffPermissions } from '../types';
import { DEFAULT_STAFF_PERMISSIONS } from '../data/defaultData';

interface StaffManagerProps {
  staffUsers: StaffUser[];
  onSaveStaffUser: (staff: StaffUser) => void;
  onDeleteStaffUser: (staffId: string) => void;
  schoolName: string;
}

export const StaffManager: React.FC<StaffManagerProps> = ({
  staffUsers = [],
  onSaveStaffUser,
  onDeleteStaffUser,
  schoolName,
}) => {
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [isNewStaff, setIsNewStaff] = useState(false);
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});
  const [showModalPassword, setShowModalPassword] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const toggleShowPassword = (id: string) => {
    setShowPasswordMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string, id: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {}
  };

  const handleStartAddStaff = () => {
    setIsNewStaff(true);
    setFormError(null);
    setShowModalPassword(true);
    const nextNumber = staffUsers.length + 1;
    setEditingStaff({
      id: `staff-${Date.now()}`,
      name: `सहायक शिक्षक ${nextNumber}`,
      username: `teacher${nextNumber}`,
      password: `pass${Math.floor(1000 + Math.random() * 9000)}`,
      role: 'staff',
      phone: '',
      isActive: true,
      permissions: {
        ...DEFAULT_STAFF_PERMISSIONS,
        canAddStudents: true,
        canEditStudents: true,
        canDeleteStudents: false,
        canEnterMarks: true,
        canBulkMarks: true,
        canExportData: true,
        canEditSchoolSettings: false,
        canManageStaff: false,
        canResetDatabase: false,
      },
      createdAt: new Date().toISOString(),
    });
  };

  const handleStartEditStaff = (staff: StaffUser) => {
    setIsNewStaff(false);
    setFormError(null);
    setShowModalPassword(false);
    setEditingStaff({
      ...staff,
      permissions: {
        ...DEFAULT_STAFF_PERMISSIONS,
        ...(staff.permissions || {}),
      },
    });
  };

  const handleToggleActive = (staff: StaffUser) => {
    const updated: StaffUser = { ...staff, isActive: !staff.isActive };
    onSaveStaffUser(updated);
    setToastMsg(
      updated.isActive
        ? `🟢 सहायक खाता '${staff.name}' सक्रिय (Active) कर दिया गया है।`
        : `🔴 सहायक खाता '${staff.name}' निष्क्रिय (Deactivated) कर दिया गया है।`
    );
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleDeleteStaff = (staff: StaffUser) => {
    if (window.confirm(`क्या आप सचमुच सहायक खाता '${staff.name}' (${staff.username}) को हटाना चाहते हैं?`)) {
      onDeleteStaffUser(staff.id);
      setToastMsg(`🗑️ सहायक खाता '${staff.name}' हटा दिया गया है।`);
      setTimeout(() => setToastMsg(null), 3000);
    }
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;

    const cleanUsername = editingStaff.username.trim().toLowerCase();
    const cleanPassword = editingStaff.password.trim();
    const cleanName = editingStaff.name.trim();

    if (!cleanName) {
      setFormError('कृपया सहायक का नाम दर्ज करें।');
      return;
    }
    if (!cleanUsername) {
      setFormError('कृपया लॉगिन यूजरनेम दर्ज करें।');
      return;
    }
    if (!cleanPassword) {
      setFormError('कृपया पासवर्ड दर्ज करें।');
      return;
    }

    // Check duplicate username if new or changed
    const duplicate = staffUsers.find(
      (s) => s.id !== editingStaff.id && s.username.toLowerCase() === cleanUsername
    );
    if (duplicate) {
      setFormError(`यूजरनेम '${cleanUsername}' पहले से किसी अन्य सहायक के पास है। कृपया दूसरा यूजरनेम चुनें।`);
      return;
    }

    const finalStaff: StaffUser = {
      ...editingStaff,
      name: cleanName,
      username: cleanUsername,
      password: cleanPassword,
    };

    onSaveStaffUser(finalStaff);
    setEditingStaff(null);
    setToastMsg(
      isNewStaff
        ? `✓ नया सहायक '${finalStaff.name}' सफलतापूर्वक जोड़ा गया! यूजरनेम: ${finalStaff.username}`
        : `✓ सहायक '${finalStaff.name}' का विवरण सफलतापूर्वक अपडेट हो गया!`
    );
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Preset Handlers
  const applyPreset = (preset: 'student_marks_only' | 'full_data_entry' | 'read_only') => {
    if (!editingStaff) return;
    if (preset === 'student_marks_only') {
      setEditingStaff({
        ...editingStaff,
        permissions: {
          canAddStudents: true,
          canEditStudents: true,
          canDeleteStudents: false,
          canEnterMarks: true,
          canBulkMarks: true,
          canExportData: true,
          canEditSchoolSettings: false,
          canManageStaff: false,
          canResetDatabase: false,
        },
      });
    } else if (preset === 'full_data_entry') {
      setEditingStaff({
        ...editingStaff,
        permissions: {
          canAddStudents: true,
          canEditStudents: true,
          canDeleteStudents: true,
          canEnterMarks: true,
          canBulkMarks: true,
          canExportData: true,
          canEditSchoolSettings: false,
          canManageStaff: false,
          canResetDatabase: false,
        },
      });
    } else if (preset === 'read_only') {
      setEditingStaff({
        ...editingStaff,
        permissions: {
          canAddStudents: false,
          canEditStudents: false,
          canDeleteStudents: false,
          canEnterMarks: false,
          canBulkMarks: false,
          canExportData: true,
          canEditSchoolSettings: false,
          canManageStaff: false,
          canResetDatabase: false,
        },
      });
    }
  };

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast */}
      {toastMsg && (
        <div className="p-3 bg-emerald-800 text-white rounded-xl shadow-lg text-xs font-bold flex items-center justify-between animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            <span>{toastMsg}</span>
          </div>
          <button onClick={() => setToastMsg(null)} className="text-white/80 hover:text-white cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#0f2b48] via-indigo-950 to-[#0f2b48] text-white p-5 sm:p-6 rounded-2xl shadow-xl border-2 border-amber-400/40 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-400/20 text-[#ffd54f] rounded-full text-xs font-bold border border-amber-400/30">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>व्यवस्थापक नियंत्रण • रोल व अनुमति प्रबंधन (Role & Permissions)</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-white">
              स्टाफ व सहायक लॉगिन नियंत्रण केंद्र (Staff Helpers Access)
            </h2>
            <p className="text-xs text-slate-200 leading-relaxed">
              यहाँ से आप अपने स्कूल के शिक्षकों अथवा सहायकों को लॉगिन क्रेडेंशियल (User ID व Password) दे सकते हैं ताकि वे <strong>विद्यार्थी जोड़ने</strong> तथा <strong>अंक चढ़ाने</strong> में आपकी सहायता कर सकें। 
              <span className="block mt-1 text-amber-300 font-semibold">
                🔒 स्कूल का नाम, लोगो, मुख्य सेटिंग्स व पासवर्ड बदलने का अधिकार केवल आपके पास सुरक्षित रहेगा!
              </span>
            </p>
          </div>

          <button
            onClick={handleStartAddStaff}
            className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-[#0f2b48] rounded-xl font-black text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer border border-amber-200 shrink-0 active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ नया सहायक / शिक्षक जोड़ें</span>
          </button>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#0f2b48] flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-blue-700" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase">कुल सहायक खाते</p>
            <p className="text-lg font-black text-slate-900">{staffUsers.length} सहायक</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase">सक्रिय खाते (Active)</p>
            <p className="text-lg font-black text-emerald-800">
              {staffUsers.filter((s) => s.isActive !== false).length} लॉगिन चालू
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase">सुरक्षा स्तर</p>
            <p className="text-xs font-bold text-amber-900">स्कूल नाम व सेटिंग्स पूरी तरह लॉक</p>
          </div>
        </div>
      </div>

      {/* Helper Accounts List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase">
              पंजीकृत सहायक स्टाफ सूची ({staffUsers.length})
            </h3>
            <p className="text-[11px] text-slate-500">
              प्रत्येक सहायक के लिए अलग यूजरनेम और पासवर्ड है जिसे वे एडमिन लॉगिन में 'सहायक लॉगिन' टैब पर उपयोग कर सकते हैं।
            </p>
          </div>
        </div>

        {staffUsers.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <Users className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">अभी कोई सहायक स्टाफ नहीं जुड़ा है</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              विद्यार्थी जोड़ने और अंक चढ़ाने में अपनी मदद के लिए ऊपर दिए गए '+ नया सहायक / शिक्षक जोड़ें' बटन से सहायक खाता बनाएं।
            </p>
            <button
              onClick={handleStartAddStaff}
              className="px-4 py-2 bg-[#0f2b48] text-white text-xs font-bold rounded-lg hover:bg-[#18426d] cursor-pointer"
            >
              + पहला सहायक खाता बनाएं
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-x-auto">
            {staffUsers.map((staff, idx) => {
              const isPasswordVisible = showPasswordMap[staff.id] || false;
              const perms = staff.permissions || DEFAULT_STAFF_PERMISSIONS;

              return (
                <div
                  key={staff.id}
                  className={`p-4 sm:p-5 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/80 ${
                    staff.isActive === false ? 'bg-slate-50/60 opacity-75' : ''
                  }`}
                >
                  {/* Left: Info */}
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="w-6 h-6 rounded-full bg-[#0f2b48] text-white text-xs font-black flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <h4 className="font-black text-sm text-slate-900">{staff.name}</h4>

                      <button
                        onClick={() => handleToggleActive(staff)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 cursor-pointer transition-all ${
                          staff.isActive !== false
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : 'bg-rose-100 text-rose-900 border border-rose-300'
                        }`}
                        title="स्थिति बदलने के लिए क्लिक करें"
                      >
                        {staff.isActive !== false ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                            <span>सक्रिय (Active)</span>
                          </>
                        ) : (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                            <span>निष्क्रिय (Disabled)</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Credentials Display Box */}
                    <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-700">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-md border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-500">यूजरनेम:</span>
                        <code className="font-mono font-bold text-[#0f2b48]">{staff.username}</code>
                        <button
                          onClick={() => copyToClipboard(staff.username, `user-${staff.id}`)}
                          className="text-slate-400 hover:text-slate-700 cursor-pointer ml-0.5"
                          title="यूजरनेम कॉपी करें"
                        >
                          {copiedId === `user-${staff.id}` ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>

                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 rounded-md border border-amber-200">
                        <span className="text-[10px] uppercase font-bold text-amber-800">पासवर्ड:</span>
                        <code className="font-mono font-bold text-amber-950">
                          {isPasswordVisible ? staff.password : '••••••••'}
                        </code>
                        <button
                          onClick={() => toggleShowPassword(staff.id)}
                          className="text-amber-700 hover:text-amber-900 cursor-pointer ml-0.5"
                          title={isPasswordVisible ? 'पासवर्ड छुपाएं' : 'पासवर्ड देखें'}
                        >
                          {isPasswordVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                        <button
                          onClick={() => copyToClipboard(staff.password, `pass-${staff.id}`)}
                          className="text-amber-700 hover:text-amber-900 cursor-pointer"
                          title="पासवर्ड कॉपी करें"
                        >
                          {copiedId === `pass-${staff.id}` ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>

                      {staff.phone && (
                        <div className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                          <Phone className="w-3 h-3" />
                          <span>{staff.phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Permissions Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">अनुमतियाँ:</span>
                      {perms.canAddStudents && (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded-md">
                          ✓ विद्यार्थी जोड़ना
                        </span>
                      )}
                      {perms.canEditStudents && (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded-md">
                          ✓ विद्यार्थी संपादन
                        </span>
                      )}
                      {perms.canEnterMarks && (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-md">
                          ✓ अंक चढ़ाना (Marks Entry)
                        </span>
                      )}
                      {perms.canBulkMarks && (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-md">
                          ✓ थोक अंक भरना
                        </span>
                      )}
                      {perms.canDeleteStudents ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-50 text-rose-900 border border-rose-200 rounded-md">
                          ⚠️ छात्र हटाना
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md">
                          🔒 छात्र डिलीट बंद
                        </span>
                      )}
                      {perms.canEditSchoolSettings ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-50 text-purple-900 border border-purple-200 rounded-md">
                          ⚠️ स्कूल सेटिंग्स संपादन
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md">
                          🔒 स्कूल सेटिंग्स सुरक्षित (Admin Only)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleStartEditStaff(staff)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-300"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-blue-700" />
                      <span>संपादित करें</span>
                    </button>

                    <button
                      onClick={() => handleDeleteStaff(staff)}
                      className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs transition-all cursor-pointer border border-rose-200"
                      title="सहायक खाता हटाएं"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Guide Card for Admin */}
      <div className="p-4 sm:p-5 bg-amber-50/80 rounded-2xl border-2 border-amber-300 shadow-xs space-y-2">
        <h4 className="font-black text-xs sm:text-sm text-amber-950 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-600" />
          <span>सहायकों को काम सौंपने का आसान तरीका (How it works):</span>
        </h4>
        <ol className="text-xs text-amber-900/90 space-y-1.5 list-decimal list-inside leading-relaxed">
          <li>ऊपर से <strong>'+ नया सहायक / शिक्षक जोड़ें'</strong> पर क्लिक करें और उनका नाम व यूजरनेम (उदा. <code>teacher1</code>) और पासवर्ड तय करें।</li>
          <li>अनुमति में डिफ़ॉल्ट रूप से <strong>केवल विद्यार्थी जोड़ना और अंक चढ़ाना</strong> चालू रहेगा, जबकि स्कूल का नाम और सेटिंग्स बदलना पूरी तरह लॉक रहेगा।</li>
          <li>सहायक शिक्षक अपने मोबाइल या कंप्यूटर पर इस पोर्टल को खोलेंगे और 'Admin Login' में <strong>'सहायक / स्टाफ'</strong> चुनकर अपना यूजरनेम व पासवर्ड डालेंगे।</li>
          <li>वे सीधे छात्र जोड़ सकेंगे और अंक चढ़ा सकेंगे। स्कूल का नाम, लोगो या व्यवस्थापक पासवर्ड बदलने का अधिकार केवल आपके पास रहेगा।</li>
        </ol>
      </div>

      {/* Staff Add / Edit Modal */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-[#0f2b48] max-w-xl w-full max-h-[92vh] flex flex-col my-auto overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 bg-[#0f2b48] text-white flex justify-between items-center shrink-0 border-b-2 border-amber-400">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm sm:text-base uppercase truncate">
                  {isNewStaff ? 'नया सहायक स्टाफ जोड़ें (+ Add Helper)' : `सहायक संपादन: ${editingStaff.name}`}
                </h3>
              </div>
              <button
                onClick={() => setEditingStaff(null)}
                className="text-slate-300 hover:text-white text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveModal} className="p-4 sm:p-6 space-y-4 text-xs font-semibold text-slate-700 overflow-y-auto flex-1">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-800 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Basic Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block mb-1 text-[11px] uppercase font-bold text-slate-800">
                    सहायक / शिक्षक का नाम *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingStaff.name}
                    onChange={(e) => setEditingStaff({ ...editingStaff, name: e.target.value })}
                    placeholder="उदा. श्री रमेश कुमार (सहायक शिक्षक)"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0f2b48] font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-[11px] uppercase font-bold text-slate-800">
                    मोबाइल नंबर (वैकल्पिक)
                  </label>
                  <input
                    type="tel"
                    value={editingStaff.phone || ''}
                    onChange={(e) => setEditingStaff({ ...editingStaff, phone: e.target.value })}
                    placeholder="9838700000"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0f2b48] text-slate-900"
                  />
                </div>
              </div>

              {/* Login Credentials */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <span className="text-[11px] font-black text-slate-900 uppercase block">
                  लॉगिन क्रेडेंशियल (Login Credentials)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1 text-[10px] uppercase font-bold text-slate-700">
                      लॉगिन यूजरनेम (Username) *
                    </label>
                    <input
                      type="text"
                      required
                      value={editingStaff.username}
                      onChange={(e) => setEditingStaff({ ...editingStaff, username: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                      placeholder="उदा. teacher1 या staff1"
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0f2b48] font-mono font-bold text-slate-900 text-xs"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">बिना स्पेस के छोटे अक्षर</span>
                  </div>

                  <div>
                    <label className="block mb-1 text-[10px] uppercase font-bold text-slate-700">
                      लॉगिन पासवर्ड (Password) *
                    </label>
                    <div className="relative">
                      <input
                        type={showModalPassword ? 'text' : 'password'}
                        required
                        value={editingStaff.password}
                        onChange={(e) => setEditingStaff({ ...editingStaff, password: e.target.value })}
                        placeholder="पासवर्ड दर्ज करें"
                        className="w-full p-2 pr-9 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0f2b48] font-mono font-bold text-slate-900 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowModalPassword(!showModalPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showModalPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-0.5 block">यह पासवर्ड सहायक को दें</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingStaff.isActive !== false}
                      onChange={(e) => setEditingStaff({ ...editingStaff, isActive: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-800">खाता सक्रिय रखें (Account Active)</span>
                  </label>
                </div>
              </div>

              {/* Permissions Control Section */}
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[11px] font-black text-indigo-950 uppercase flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-indigo-700" />
                    अनुमति नियंत्रण (Permissions Matrix)
                  </span>

                  {/* One-click Presets */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => applyPreset('student_marks_only')}
                      className="px-2 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded text-[10px] font-black shadow-xs cursor-pointer border border-amber-300 flex items-center gap-1"
                      title="केवल छात्र व अंक चढ़ाना (अनुशंसित)"
                    >
                      <Sparkles className="w-3 h-3 text-slate-950" />
                      <span>🎯 छात्र + अंक (अनुशंसित)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('full_data_entry')}
                      className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-800 rounded text-[10px] font-bold shadow-xs cursor-pointer border border-slate-300"
                    >
                      पूर्ण एंट्री
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('read_only')}
                      className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-800 rounded text-[10px] font-bold shadow-xs cursor-pointer border border-slate-300"
                    >
                      केवल दर्शक
                    </button>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  {/* 1. Add Students */}
                  <label className="flex items-start gap-2.5 p-2 bg-white rounded-lg border border-indigo-100 cursor-pointer hover:border-indigo-300 transition-all">
                    <input
                      type="checkbox"
                      checked={editingStaff.permissions?.canAddStudents !== false}
                      onChange={(e) =>
                        setEditingStaff({
                          ...editingStaff,
                          permissions: { ...editingStaff.permissions, canAddStudents: e.target.checked },
                        })
                      }
                      className="w-4 h-4 accent-indigo-700 rounded mt-0.5 cursor-pointer shrink-0"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">1. विद्यार्थी जोड़ना (Can Add Students)</span>
                      <span className="text-[10px] text-slate-500 block">सहायक नया छात्र पोर्टल में पंजीकृत कर सकेगा।</span>
                    </div>
                  </label>

                  {/* 2. Edit Students */}
                  <label className="flex items-start gap-2.5 p-2 bg-white rounded-lg border border-indigo-100 cursor-pointer hover:border-indigo-300 transition-all">
                    <input
                      type="checkbox"
                      checked={editingStaff.permissions?.canEditStudents !== false}
                      onChange={(e) =>
                        setEditingStaff({
                          ...editingStaff,
                          permissions: { ...editingStaff.permissions, canEditStudents: e.target.checked },
                        })
                      }
                      className="w-4 h-4 accent-indigo-700 rounded mt-0.5 cursor-pointer shrink-0"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">2. विद्यार्थी विवरण सुधारना (Can Edit Students)</span>
                      <span className="text-[10px] text-slate-500 block">छात्र का नाम, रोल नंबर, माता-पिता का नाम आदि संपादित कर सकेगा।</span>
                    </div>
                  </label>

                  {/* 3. Enter & Edit Marks */}
                  <label className="flex items-start gap-2.5 p-2 bg-white rounded-lg border border-indigo-100 cursor-pointer hover:border-indigo-300 transition-all">
                    <input
                      type="checkbox"
                      checked={editingStaff.permissions?.canEnterMarks !== false}
                      onChange={(e) =>
                        setEditingStaff({
                          ...editingStaff,
                          permissions: { ...editingStaff.permissions, canEnterMarks: e.target.checked },
                        })
                      }
                      className="w-4 h-4 accent-indigo-700 rounded mt-0.5 cursor-pointer shrink-0"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">3. अंक चढ़ाना व सुरक्षित करना (Can Enter Marks)</span>
                      <span className="text-[10px] text-slate-500 block">अर्द्धवार्षिक व वार्षिक परीक्षा के अंक भर व सुरक्षित कर सकेगा।</span>
                    </div>
                  </label>

                  {/* 4. Bulk Marks Entry */}
                  <label className="flex items-start gap-2.5 p-2 bg-white rounded-lg border border-indigo-100 cursor-pointer hover:border-indigo-300 transition-all">
                    <input
                      type="checkbox"
                      checked={editingStaff.permissions?.canBulkMarks !== false}
                      onChange={(e) =>
                        setEditingStaff({
                          ...editingStaff,
                          permissions: { ...editingStaff.permissions, canBulkMarks: e.target.checked },
                        })
                      }
                      className="w-4 h-4 accent-indigo-700 rounded mt-0.5 cursor-pointer shrink-0"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">4. एक साथ सभी अंक भरना (Can Bulk Enter Marks)</span>
                      <span className="text-[10px] text-slate-500 block">बल्क मार्क्स टेबल से एक कक्षा के सभी अंक भर सकेगा।</span>
                    </div>
                  </label>

                  {/* 5. View Marksheets & Print */}
                  <label className="flex items-start gap-2.5 p-2 bg-white rounded-lg border border-indigo-100 cursor-pointer hover:border-indigo-300 transition-all">
                    <input
                      type="checkbox"
                      checked={editingStaff.permissions?.canExportData !== false}
                      onChange={(e) =>
                        setEditingStaff({
                          ...editingStaff,
                          permissions: { ...editingStaff.permissions, canExportData: e.target.checked },
                        })
                      }
                      className="w-4 h-4 accent-indigo-700 rounded mt-0.5 cursor-pointer shrink-0"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">5. अंकपत्र देखना व प्रिंट करना (View & Print)</span>
                      <span className="text-[10px] text-slate-500 block">तैयार अंकपत्र देख और प्रिंट कर सकेगा।</span>
                    </div>
                  </label>

                  {/* RESTRICTED PERMISSIONS (By default OFF) */}
                  <div className="pt-2 border-t border-indigo-200/80 space-y-2">
                    <span className="text-[10px] font-black text-rose-800 uppercase block">
                      ⚠️ संवेदनशील अनुमतियाँ (सुरक्षा कारणों से बंद रखना अनुशंसित):
                    </span>

                    {/* Delete Students */}
                    <label className="flex items-start gap-2.5 p-2 bg-rose-50/60 rounded-lg border border-rose-200 cursor-pointer hover:border-rose-300 transition-all">
                      <input
                        type="checkbox"
                        checked={editingStaff.permissions?.canDeleteStudents === true}
                        onChange={(e) =>
                          setEditingStaff({
                            ...editingStaff,
                            permissions: { ...editingStaff.permissions, canDeleteStudents: e.target.checked },
                          })
                        }
                        className="w-4 h-4 accent-rose-700 rounded mt-0.5 cursor-pointer shrink-0"
                      />
                      <div>
                        <span className="text-xs font-bold text-rose-950 block">छात्र हटाना (Can Delete Students)</span>
                        <span className="text-[10px] text-rose-700 block">छात्रों को रीसायकल बिन में भेजने की अनुमति (डिफ़ॉल्ट बंद)।</span>
                      </div>
                    </label>

                    {/* Edit School Settings */}
                    <label className="flex items-start gap-2.5 p-2 bg-rose-50/60 rounded-lg border border-rose-200 cursor-pointer hover:border-rose-300 transition-all">
                      <input
                        type="checkbox"
                        checked={editingStaff.permissions?.canEditSchoolSettings === true}
                        onChange={(e) =>
                          setEditingStaff({
                            ...editingStaff,
                            permissions: { ...editingStaff.permissions, canEditSchoolSettings: e.target.checked },
                          })
                        }
                        className="w-4 h-4 accent-rose-700 rounded mt-0.5 cursor-pointer shrink-0"
                      />
                      <div>
                        <span className="text-xs font-bold text-rose-950 block">🔒 स्कूल का नाम व सेटिंग्स बदलना (Can Edit School Name & Settings)</span>
                        <span className="text-[10px] text-rose-700 block">सख्त मना: इसे बंद रखने पर सहायक स्कूल का नाम या लोगो नहीं बदल सकेगा।</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                >
                  रद्द करें
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0f2b48] hover:bg-[#18426d] text-white rounded-lg text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4 text-amber-400" />
                  <span>{isNewStaff ? 'सहायक खाता सुरक्षित करें' : 'बदलाव सुरक्षित करें'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
