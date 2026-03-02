import { useState, useEffect } from 'react';
import logoImg from '@/assets/logo.png';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useGradientMode } from '@/hooks/useGradientMode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

function useClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const hours = String(time.getHours()).padStart(2, '0');
  const minutes = String(time.getMinutes()).padStart(2, '0');
  return {
    hours,
    minutes,
    date: `${days[time.getDay()]}, ${months[time.getMonth()]} ${time.getDate()}`
  };
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'email' | 'password'>('email');
  const [stage, setStage] = useState<'lock' | 'welcome'>('lock');
  const [showWelcome, setShowWelcome] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [error, setError] = useState('');
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const { dashboardProps } = useGradientMode();
  const clock = useClock();

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setStep('password');
      setError('');
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const success = await login(email, password);
    if (success) {
      setStage('welcome');
      setShowWelcome(true);
    } else {
      setShaking(true);
      setError('Incorrect password. Please try again.');
      setPassword('');
      setTimeout(() => setShaking(false), 600);
    }
  };

  useEffect(() => {
    if (showWelcome) {
      const timer = setTimeout(() => {
        const stored = JSON.parse(localStorage.getItem('nextios_user') || '{}');
        navigate(stored.role === 'admin' ? '/dashboard' : '/reseller');
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [showWelcome, navigate]);

  return (
    <div className={`${dashboardProps.className} items-center justify-center p-4 relative overflow-hidden select-none`} style={dashboardProps.style}>
      {/* Animated floating blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-primary/10 blur-[100px] animate-float" />
        <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] rounded-full bg-accent/15 blur-[100px] animate-float-delayed" />
        <div className="absolute top-1/2 left-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px] animate-float-slow" />
      </div>

      {stage === 'lock' && (
        <>
          <div className="absolute top-10 z-10 hidden sm:flex flex-col items-center opacity-0 animate-fade-in">
            <div className="flex items-baseline gap-1">
              <span className="text-7xl font-extralight text-foreground tracking-tighter tabular-nums">{clock.hours}</span>
              <span className="text-7xl font-extralight text-foreground/40 tracking-tighter animate-pulse">:</span>
              <span className="text-7xl font-extralight text-foreground tracking-tighter tabular-nums">{clock.minutes}</span>
            </div>
            <p className="text-base text-muted-foreground mt-1 font-light tracking-wide">{clock.date}</p>
          </div>

          <div className="relative z-10 flex flex-col items-center opacity-0 animate-scale-in mt-16">
            <div className="h-24 w-24 rounded-full bg-card/60 backdrop-blur-xl border border-border/30 flex items-center justify-center mb-4 shadow-2xl overflow-hidden">
              <img src={logoImg} alt="Next iOS" className="h-16 w-16 rounded-2xl object-contain brightness-0 dark:brightness-0 dark:invert" />
            </div>

            <h1 className="text-xl font-semibold text-foreground mb-6">Next iOS</h1>

            {step === 'email' && (
              <form onSubmit={handleEmailSubmit} className="flex items-center gap-2 w-64">
                <Input
                  type="text"
                  placeholder="Enter Username"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="h-10 flex-1 bg-card/50 backdrop-blur-md border border-border/30 text-foreground placeholder:text-muted-foreground rounded-xl text-sm text-center"
                />
                {email.trim() && (
                  <Button
                    type="submit"
                    size="icon"
                    className="h-10 w-10 rounded-xl bg-card/60 backdrop-blur-md border border-border/30 hover:bg-card/80 text-foreground animate-fade-in"
                  >
                    <span className="text-lg">→</span>
                  </Button>
                )}
              </form>
            )}

            {step === 'password' && (
              <form onSubmit={handlePasswordSubmit} className={`flex flex-col items-center gap-3 w-64 ${shaking ? 'animate-shake' : ''}`}>
                <p className="text-xs text-muted-foreground mb-1">{email}</p>
                <div className="flex items-center gap-2 w-full">
                  <Button
                    type="button"
                    size="icon"
                    onClick={() => { setStep('email'); setError(''); }}
                    className="h-10 w-10 rounded-xl bg-card/60 backdrop-blur-md border border-border/30 hover:bg-card/80 text-foreground shrink-0"
                  >
                    <span className="text-lg">←</span>
                  </Button>
                  <Input
                    type="password"
                    placeholder="Enter Password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    required
                    autoFocus
                    className="h-10 flex-1 bg-card/50 backdrop-blur-md border border-border/30 text-foreground placeholder:text-muted-foreground rounded-xl text-sm text-center"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={loading}
                    className="h-10 w-10 rounded-xl bg-card/60 backdrop-blur-md border border-border/30 hover:bg-card/80 text-foreground"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-lg">→</span>}
                  </Button>
                </div>
                {error && (
                  <p className="text-[11px] text-destructive font-medium animate-fade-in">{error}</p>
                )}
              </form>
            )}

            <p className="text-xs text-muted-foreground/60 mt-4 text-center">
              Sign in with your panel credentials
            </p>
          </div>
        </>
      )}
      {stage === 'welcome' && (
        <div className="relative z-10 flex flex-col items-center opacity-0 animate-fade-in">
          <div className="h-28 w-28 rounded-full bg-card/60 backdrop-blur-xl border border-border/30 flex items-center justify-center mb-5 shadow-2xl">
            <img src={logoImg} alt="Next iOS" className="h-20 w-20 rounded-2xl object-contain brightness-0 dark:brightness-0 dark:invert" />
          </div>

          <h1 className="text-2xl font-semibold text-foreground mb-2">
            {JSON.parse(localStorage.getItem('nextios_user') || '{}').name || 'User'}
          </h1>
          <p className="text-sm text-muted-foreground">Logging in...</p>

          <div className="mt-6">
            <div className="h-1 w-32 bg-border/30 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full animate-progress" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
