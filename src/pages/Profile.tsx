import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { 
  User, Coins, History, LogOut, Sparkles, 
  ArrowUpRight, ArrowDownRight, Gift, ShoppingCart,
  Film, Clock
} from 'lucide-react';
import { BuyCreditsModal } from '@/components/credits/BuyCreditsModal';

interface Transaction {
  id: string;
  amount: number;
  transaction_type: string;
  description: string | null;
  created_at: string;
  clip_duration_seconds: number | null;
}

export default function Profile() {
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchTransactions();
    }
  }, [user]);

  const fetchTransactions = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching transactions:', error);
    } else {
      setTransactions(data || []);
    }
    setLoadingTransactions(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
    toast.success('Signed out successfully');
  };

  const handlePurchaseComplete = () => {
    refreshProfile();
    fetchTransactions();
    setShowBuyModal(false);
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-12 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const getTransactionIcon = (type: string, amount: number) => {
    if (type === 'bonus') return <Gift className="w-4 h-4 text-emerald-400" />;
    if (type === 'purchase') return <ShoppingCart className="w-4 h-4 text-primary" />;
    if (amount < 0) return <ArrowDownRight className="w-4 h-4 text-red-400" />;
    return <ArrowUpRight className="w-4 h-4 text-emerald-400" />;
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <User className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              {profile?.display_name || 'Creator'}
            </h1>
            <p className="text-muted-foreground text-sm">{profile?.email}</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleSignOut} className="gap-2">
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Current Balance */}
        <Card className="card-violet border-0">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Coins className="w-5 h-5 text-white" />
              </div>
              <span className="text-white/80 text-sm font-medium">Balance</span>
            </div>
            <p className="text-4xl font-display font-bold text-white">
              {profile?.credits_balance.toLocaleString() || 0}
            </p>
            <p className="text-white/60 text-xs mt-1">Credits available</p>
          </CardContent>
        </Card>

        {/* Total Purchased */}
        <Card className="card-clean">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5 text-emerald-600" />
              </div>
              <span className="text-muted-foreground text-sm font-medium">Purchased</span>
            </div>
            <p className="text-3xl font-display font-bold text-foreground">
              {profile?.total_credits_purchased.toLocaleString() || 0}
            </p>
            <p className="text-muted-foreground text-xs mt-1">Total credits bought</p>
          </CardContent>
        </Card>

        {/* Total Used */}
        <Card className="card-clean">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                <Film className="w-5 h-5 text-primary" />
              </div>
              <span className="text-muted-foreground text-sm font-medium">Used</span>
            </div>
            <p className="text-3xl font-display font-bold text-foreground">
              {profile?.total_credits_used.toLocaleString() || 0}
            </p>
            <p className="text-muted-foreground text-xs mt-1">Credits spent on videos</p>
          </CardContent>
        </Card>
      </div>

      {/* Buy Credits Button */}
      <Button 
        onClick={() => setShowBuyModal(true)}
        className="w-full h-14 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white font-medium text-lg gap-3"
      >
        <Sparkles className="w-5 h-5" />
        Buy More Credits
      </Button>

      {/* Transaction History */}
      <Card className="card-clean">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="w-5 h-5 text-primary" />
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTransactions ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No transactions yet</p>
              <p className="text-sm">Your credit activity will appear here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div 
                  key={tx.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-background flex items-center justify-center">
                      {getTransactionIcon(tx.transaction_type, tx.amount)}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-foreground">
                        {tx.description || tx.transaction_type}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {new Date(tx.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                        {tx.clip_duration_seconds && (
                          <span className="text-primary">• {tx.clip_duration_seconds}s clip</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={`font-display font-bold ${
                    tx.amount >= 0 ? 'text-emerald-600' : 'text-red-500'
                  }`}>
                    {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Buy Credits Modal */}
      <BuyCreditsModal 
        open={showBuyModal} 
        onOpenChange={setShowBuyModal}
        onPurchaseComplete={handlePurchaseComplete}
      />
    </div>
  );
}
