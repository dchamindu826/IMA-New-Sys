import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { Loader2, Eye, EyeOff, UserPlus } from 'lucide-react';

const GlassInput = ({ label, name, required, type = "text", placeholder, options, value, onChange }) => (
  <div>
    <label className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-2 block">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {options ? (
      <div className="relative">
          <select name={name} required={required} value={value} onChange={onChange} className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white focus:border-red-500 focus:bg-black/60 outline-none transition-all text-sm shadow-inner appearance-none cursor-pointer">
            <option value="" disabled className="bg-slate-900">Select a District</option>
            {options.map(opt => <option key={opt} value={opt} className="bg-slate-900">{opt}</option>)}
          </select>
      </div>
    ) : (
      <input type={type} name={name} required={required} value={value} onChange={onChange} placeholder={placeholder} className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white placeholder-white/30 focus:border-red-500 focus:bg-black/60 outline-none transition-all text-sm shadow-inner" />
    )}
  </div>
);

export default function Register() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    fName: '', lName: '', phone: '', directPhone: '', nic: '',
    houseNoVal: '', streetNameVal: '', villageVal: '', townVal: '', districtVal: '', password: ''
  });

  const districts = ["Ampara", "Anuradhapura", "Badulla", "Batticaloa", "Colombo", "Galle", "Gampaha", "Hambantota", "Jaffna", "Kalutara", "Kandy", "Kegalle", "Kilinochchi", "Kurunegala", "Mannar", "Matale", "Matara", "Monaragala", "Mullaitivu", "Nuwara Eliya", "Polonnaruwa", "Puttalam", "Ratnapura", "Trincomalee", "Vavuniya"];

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/register', formData); 
      toast.success("Account created successfully! Please login.");
      navigate('/login');
    } catch (error) {
      toast.error(error.response?.data?.message || "Registration failed. Please check details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 py-12 font-sans overflow-hidden">
      
      {/* 🚀 Background Image & Frosted Glass Overlay 🚀 */}
      <div className="absolute inset-0 z-0 fixed">
          <img src="/mainglass.jpg" alt="Background" className="w-full h-full object-cover scale-105" />
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-xl"></div>
      </div>

      {/* 🚀 Darker Glass Card 🚀 */}
      <div className="relative z-10 w-full max-w-4xl bg-slate-900/60 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-[0_25px_50px_rgba(0,0,0,0.5)] p-8 md:p-12 animate-fade-in">
        
        <div className="text-center mb-10">
          <div className="bg-white/5 p-4 rounded-[2rem] inline-block mb-4 border border-white/10 shadow-inner">
            <UserPlus size={40} className="text-red-500 drop-shadow-lg" />
          </div>
          <h2 className="text-3xl font-black text-white tracking-wide">Create an account</h2>
          <p className="text-white/60 text-sm mt-2 font-medium">Join the IMA Campus student portal today</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            <GlassInput label="First Name" name="fName" required placeholder="Chamindu" value={formData.fName} onChange={handleChange} />
            <GlassInput label="Last Name" name="lName" required placeholder="Dilshan" value={formData.lName} onChange={handleChange} />
            
            <GlassInput label="Phone Number" name="phone" type="tel" required placeholder="07********" value={formData.phone} onChange={handleChange} />
            <GlassInput label="Secondary Number" name="directPhone" type="tel" placeholder="07******** (Optional)" value={formData.directPhone} onChange={handleChange} />
            
            <div className="md:col-span-2">
              <GlassInput label="National Identity Card (NIC)" name="nic" required placeholder="e.g. 199912345678" value={formData.nic} onChange={handleChange} />
            </div>

            <GlassInput label="House Number" name="houseNoVal" placeholder="e.g. 123/A (Optional)" value={formData.houseNoVal} onChange={handleChange} />
            <GlassInput label="Street Name" name="streetNameVal" required placeholder="Main Street" value={formData.streetNameVal} onChange={handleChange} />
            
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
                <GlassInput label="Village" name="villageVal" required placeholder="Your Village" value={formData.villageVal} onChange={handleChange} />
                <GlassInput label="Town" name="townVal" required placeholder="Your Town" value={formData.townVal} onChange={handleChange} />
                <GlassInput label="District" name="districtVal" required options={districts} value={formData.districtVal} onChange={handleChange} />
            </div>

            <div className="md:col-span-2 mt-4 pt-6 border-t border-white/10">
              <label className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-2 block">Secure Password <span className="text-red-500">*</span></label>
              <div className="relative group">
                <input 
                    type={showPassword ? "text" : "password"} 
                    name="password" required value={formData.password} onChange={handleChange} 
                    className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 pr-14 text-white placeholder-white/30 focus:border-red-500 focus:bg-black/60 outline-none transition-all text-sm shadow-inner" 
                    placeholder="Create a strong password" 
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-4 flex items-center text-white/40 hover:text-white transition-colors">
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
          </div>

          <div className="pt-10 flex flex-col items-center">
            <button type="submit" disabled={loading} className="w-full md:w-auto md:min-w-[300px] px-12 py-4 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-white font-black rounded-2xl transition-all shadow-[0_0_20px_rgba(239,68,68,0.4)] flex items-center justify-center gap-2 text-sm uppercase tracking-widest hover:scale-105 disabled:opacity-70">
                {loading ? <Loader2 size={20} className="animate-spin" /> : 'Create Account'}
            </button>
            <p className="mt-8 text-sm text-white/60 font-medium">
                Already have an account? <Link to="/login" className="text-red-400 font-bold hover:text-red-300 hover:underline transition-colors ml-1">Log in here</Link>
            </p>
          </div>
        </form>

      </div>
    </div>
  );
}