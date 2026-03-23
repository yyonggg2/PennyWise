import { useState } from "react";
import { supabase } from "./supabase";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleEmailAuth = async () => {
    setLoading(true);
    setError("");
    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FFFAF0] to-[#FFFAF0]">
      <div className="bg-white p-8 rounded-2xl w-full max-w-sm flex flex-col gap-4 shadow-2xl border border-white/10">
        <h1 className="text-2xl font-bold text-black text-center">PennyWise</h1>
        <p className="text-slate-400 text-center text-sm">
          {isSignUp ? "Create an account" : "Welcome back"}
        </p>

        <button
          onClick={handleGoogle}
          className="w-full bg-slate-400 text-slate-900 font-medium py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-slate-500"
        >
          <img src="https://www.google.com/favicon.ico" className="w-4 h-4" />
          Continue with Google
        </button>

        <div className="flex items-center gap-2 text-slate-600 text-sm">
          <div className="flex-1 h-px bg-slate-600" />
          or
          <div className="flex-1 h-px bg-slate-600" />
        </div>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-[#FFFAF0] text-black/50 px-4 py-2 rounded-lg outline-none placeholder-slate-500"
        />
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-[#FFFAF0] text-black/50 px-4 py-2 rounded-lg outline-none placeholder-slate-500 w-full"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
          >
            {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={handleEmailAuth}
          disabled={loading}
          className="w-full bg-slate-400 hover:bg-slate-500 text-black font-medium py-2 rounded-lg"
        >
          {loading ? "Loading..." : isSignUp ? "Sign Up" : "Sign In"}
        </button>

        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-slate-400 text-sm text-center"
        >
          {isSignUp
            ? "Already have an account? Sign in"
            : "Don't have an account? Sign up"}
        </button>
      </div>
    </div>
  );
}
