import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Edit2, Lock, UserX, Ban, Eye, EyeOff, Plus, Search, Filter, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { topToast as toast, formatRoleForDisplay } from '@/lib/topToast';
import { DataTable, type DataColumn } from '@/components/DataTable';
import { usersApi } from '@/lib/backend-users';
import { formatINR } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

type ManagedUser = {
  id: string; name: string; username: string; password: string;
  role: 'admin' | 'reseller' | 'banned'; balance: number; licenses: number;
  lastActive: string; assignTo: string; status: 'active' | 'disabled' | 'banned';
};

const toIsoFromEpoch = (rawEpoch: number): string => {
  if (!Number.isFinite(rawEpoch) || rawEpoch <= 0) return '';
  // Backend may return either seconds or milliseconds.
  const epochMs = rawEpoch > 1_000_000_000_000 ? rawEpoch : rawEpoch * 1000;
  const dt = new Date(epochMs);
  return Number.isNaN(dt.getTime()) ? '' : dt.toISOString();
};

export default function AdminUsers() {
  const { user: authUser } = useAuth();
  const currentUsername = authUser?.username ?? '';
  const [search, setSearch] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [adminUsers, setAdminUsers] = useState<Array<{ username: string; name: string }>>([]);
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'reseller' | 'banned'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled' | 'banned'>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', username: '', password: '', role: 'reseller' as 'admin' | 'reseller' | 'banned', balance: 0 });
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [tableLoading, setTableLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    username: '',
    role: 'reseller' as 'admin' | 'reseller' | 'banned',
    balance: 0,
  });
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  const load = async () => {
    try {
      const [list, admins] = await Promise.all([usersApi.getAllUsers(), usersApi.getAdminUsers()]);
      setUsers(list.map((u) => ({
        id: u.username,
        name: u.name,
        username: u.username,
        password: u.password,
        role: u.role === 'admin' ? 'admin' : u.role === 'banned' ? 'banned' : 'reseller',
        balance: u.balance,
        licenses: u.licenses,
        lastActive: toIsoFromEpoch(u.lastActive),
        assignTo: u.assignedTo || '—',
        status: u.role === 'banned' ? 'banned' : 'active',
      })));
      setAdminUsers(admins);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load users';
      toast.error(message);
    }
  };

  useEffect(() => { load().finally(() => setTableLoading(false)); }, []);

  const togglePassword = (id: string) => setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
  const updateRole = async (id: string, newRole: 'admin' | 'reseller' | 'banned') => {
    const user = users.find((u) => u.id === id);
    if (!user) return;
    try {
      await usersApi.editUser({
        targetUsername: user.username,
        newUsername: user.username,
        newPassword: '',
        newName: user.name,
        newRole,
        newBalance: user.balance,
      });
      toast.success(`Role updated to ${formatRoleForDisplay(newRole)}`, 'Role updated');
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update role';
      toast.error(message);
    }
  };
  const updateAssignTo = async (id: string, assignTo: string) => {
    const user = users.find((u) => u.id === id);
    if (!user) return;
    try {
      await usersApi.updateUserAssignment(user.username, assignTo);
      toast.success(`Assigned to ${assignTo === '—' ? 'None' : assignTo}`, 'Assigned');
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update assignment';
      toast.error(message);
    }
  };
  const banUser = async (id: string) => {
    const user = users.find((u) => u.id === id);
    if (!user) return;
    try {
      const shouldBan = user.status !== 'banned';
      await usersApi.toggleUserBan(user.username, shouldBan);
      toast.success(shouldBan ? `${user.name} banned` : `${user.name} unbanned`, shouldBan ? 'Banned' : 'Unbanned');
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to change user status';
      toast.error(message);
    }
  };

  const handleAddUser = async () => {
    if (!newUser.name || !newUser.username || !newUser.password) return;
    try {
      await usersApi.createUser({
        username: newUser.username,
        password: newUser.password,
        name: newUser.name,
        role: newUser.role,
        initialBalance: Math.max(0, Number(newUser.balance) || 0),
      });
      setNewUser({ name: '', username: '', password: '', role: 'reseller', balance: 0 });
      setAddOpen(false);
      toast.success(`${newUser.name} added`, 'User added');
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add user';
      toast.error(message);
    }
  };

  const openEditDialog = (u: ManagedUser) => {
    setSelectedUser(u);
    setEditForm({
      name: u.name,
      username: u.username,
      role: u.role,
      balance: u.balance,
    });
    setEditOpen(true);
  };

  const openPasswordDialog = (u: ManagedUser) => {
    setSelectedUser(u);
    setPasswordForm({ newPassword: '', confirmPassword: '' });
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setPasswordOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!selectedUser) return;
    try {
      await usersApi.editUser({
        targetUsername: selectedUser.username,
        newUsername: editForm.username.trim() || selectedUser.username,
        newPassword: '',
        newName: editForm.name.trim() || selectedUser.name,
        newRole: editForm.role,
        newBalance: Math.max(0, Number(editForm.balance) || 0),
      });
      toast.success(`Updated ${selectedUser.name}`, 'Updated');
      setEditOpen(false);
      setSelectedUser(null);
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to edit user';
      toast.error(message);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!selectedUser) return;
    if (!passwordForm.newPassword.trim()) {
      toast.error('Password is required');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    try {
      await usersApi.changePassword(selectedUser.username, passwordForm.newPassword);
      toast.success(`Password changed for ${selectedUser.name}`, 'Password changed');
      setPasswordOpen(false);
      setSelectedUser(null);
      setPasswordForm({ newPassword: '', confirmPassword: '' });
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to change password';
      toast.error(message);
    }
  };

  const filtered = users
    .filter(u => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.username.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.status === 'banned' && b.status !== 'banned') return 1;
      if (a.status !== 'banned' && b.status === 'banned') return -1;
      return b.balance - a.balance;
    });

  const formatDate = (d: string) => {
    if (!d) return '—';
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return '—';
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    let hours = date.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `${days[date.getDay()]}, ${dd}-${mm}-${yyyy} ${String(hours).padStart(2, '0')}:${mins} ${ampm}`;
  };

  const columns: DataColumn<ManagedUser>[] = [
    { key: 'name', header: 'Name', sortable: true, cellClassName: 'text-xs font-medium', render: (u) => u.name },
    { key: 'username', header: 'Username', sortable: true, cellClassName: 'text-xs font-mono text-muted-foreground', render: (u) => u.username },
    {
      key: 'password', header: 'Password', headerClassName: 'text-center', cellClassName: 'text-center',
      render: (u) => (
        <div className="flex items-center justify-center gap-1.5 w-full">
          <span className="font-mono text-xs text-muted-foreground">{visiblePasswords[u.id] ? u.password : '••••••••'}</span>
          <button onClick={(e) => { e.stopPropagation(); togglePassword(u.id); }} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
            {visiblePasswords[u.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
      ),
    },
    {
      key: 'role', header: 'Role', sortable: true,
      render: (u) => {
        const isSelf = u.username === currentUsername;
        return (
          <Select
            value={u.role}
            onValueChange={v => updateRole(u.id, v as 'admin' | 'reseller' | 'banned')}
            disabled={isSelf}
          >
            <SelectTrigger className="h-7 w-24 text-[10px] rounded-lg border-border/50" title={isSelf ? 'You cannot change your own role' : undefined}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="reseller">Reseller</SelectItem>
              <SelectItem value="banned">Banned</SelectItem>
            </SelectContent>
          </Select>
        );
      },
    },
    {
      key: 'balance', header: 'Balance', sortable: true, cellClassName: 'text-xs font-medium',
      render: (u) => <span className="inline-flex items-center gap-0.5">{formatINR(u.balance)}</span>,
    },
    { key: 'licenses', header: 'Licenses', sortable: true, cellClassName: 'text-xs', render: (u) => u.licenses },
    { key: 'lastActive', header: 'Last Active', sortable: true, cellClassName: 'text-xs text-muted-foreground whitespace-nowrap', render: (u) => formatDate(u.lastActive) },
    {
      key: 'assignTo', header: 'Assign To',
      render: (u) => (
        <Select value={u.assignTo} onValueChange={v => updateAssignTo(u.id, v)}>
          <SelectTrigger className="h-7 w-28 text-[10px] rounded-lg border-border/50"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="—">None</SelectItem>
            {adminUsers.map(admin => (<SelectItem key={admin.username} value={admin.username}>{admin.name}</SelectItem>))}
          </SelectContent>
        </Select>
      ),
    },
    {
      key: 'action', header: 'Action', headerClassName: 'text-right', cellClassName: 'text-right',
      render: (u) => {
        const isSelf = u.username === currentUsername;
        return (
          <div className="w-full flex items-center justify-end gap-0.5">
            <Button variant="ghost" size="icon" onClick={() => openEditDialog(u)} title="Edit" className="rounded-lg h-7 w-7 text-primary hover:bg-primary/15">
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => openPasswordDialog(u)} title="Change Password" className="rounded-lg h-7 w-7 text-amber-500 hover:text-amber-400 hover:bg-amber-500/15">
              <Lock className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => banUser(u.id)}
              title={isSelf ? 'You cannot ban yourself' : (u.status === 'banned' ? 'Unban' : 'Ban')}
              disabled={isSelf}
              className={u.status === 'banned' ? 'rounded-lg h-7 w-7 text-emerald-600 hover:bg-emerald-500/15' : 'rounded-lg h-7 w-7 text-warning hover:bg-warning/15'}
            >
              <Ban className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={async () => {
                try {
                  await usersApi.deleteUser(u.username);
                  toast.success(`${u.name} removed`, 'User removed');
                  await load();
                } catch (err) {
                  const message = err instanceof Error ? err.message : 'Failed to remove user';
                  toast.error(message);
                }
              }}
              title={isSelf ? 'You cannot delete your own account' : 'Delete'}
              disabled={isSelf}
              className="rounded-lg h-7 w-7 text-destructive hover:bg-destructive/15"
            >
              <UserX className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 pointer-events-none" />
            <Input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} className="h-10 pl-9 rounded-xl border border-border/30 bg-card/60 text-sm" />
          </div>
          <Select value={roleFilter} onValueChange={v => setRoleFilter(v as any)}>
            <SelectTrigger className="h-10 rounded-xl border border-border/30 bg-card/60 w-10 p-0 justify-center md:w-32 md:px-3 md:justify-start md:gap-1.5 [&>svg.lucide-chevron-down]:hidden md:[&>svg.lucide-chevron-down]:block [&>span]:hidden md:[&>span]:inline text-xs font-medium">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="reseller">Reseller</SelectItem>
              <SelectItem value="banned">Banned</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
            <SelectTrigger className="h-10 rounded-xl border border-border/30 bg-card/60 w-10 p-0 justify-center md:w-36 md:px-3 md:justify-start md:gap-1.5 [&>svg.lucide-chevron-down]:hidden md:[&>svg.lucide-chevron-down]:block [&>span]:hidden md:[&>span]:inline text-xs font-medium whitespace-nowrap md:[&>span]:whitespace-nowrap">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
              <SelectItem value="banned">Banned</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto hidden md:flex items-center gap-2 shrink-0 h-10">
            <span className="text-xs text-muted-foreground font-medium flex items-center h-10">{filtered.length} users</span>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button className="hidden md:inline-flex h-10 rounded-xl border border-primary/30 bg-primary text-primary-foreground shadow-md shadow-primary/20 gap-1.5 text-xs font-medium hover:bg-primary/90">
                  <Plus className="h-4 w-4" /> Add User
                </Button>
              </DialogTrigger>
            <DialogTrigger asChild>
              <Button size="icon" className="md:hidden fixed bottom-24 right-4 z-50 h-10 w-10 rounded-xl border border-primary/30 bg-primary text-primary-foreground shadow-lg shadow-primary/30">
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[calc(100%-2.5rem)] max-w-sm sm:max-w-md border-border/30 rounded-2xl p-0 overflow-hidden">
              <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold flex items-center gap-2">
                    <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-primary/15 flex items-center justify-center">
                      <UserPlus className="h-4 w-4 text-primary" />
                    </div>
                    Add New User
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Create a new admin or reseller account</p>
                </DialogHeader>
              </div>
              <div className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-3 sm:space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</Label>
                    <Input value={newUser.name} onChange={e => setNewUser(f => ({ ...f, name: e.target.value }))} placeholder="Full Name" className="rounded-xl h-9 sm:h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Username</Label>
                    <Input value={newUser.username} onChange={e => setNewUser(f => ({ ...f, username: e.target.value }))} placeholder="username" className="rounded-xl h-9 sm:h-10 font-mono" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Password</Label>
                  <Input type="password" value={newUser.password} onChange={e => setNewUser(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" className="rounded-xl h-9 sm:h-10" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</Label>
                    <Select value={newUser.role} onValueChange={v => setNewUser(f => ({ ...f, role: v as 'admin' | 'reseller' | 'banned' }))}>
                      <SelectTrigger className="rounded-xl h-9 sm:h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="reseller">Reseller</SelectItem>
                        <SelectItem value="banned">Banned</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Initial Balance</Label>
                    <Input
                      type="number"
                      min={0}
                      value={newUser.balance}
                      onChange={e => setNewUser(f => ({ ...f, balance: Number(e.target.value) || 0 }))}
                      className="rounded-xl h-9 sm:h-10"
                    />
                  </div>
                </div>
                <Button onClick={handleAddUser} disabled={!newUser.name || !newUser.username || !newUser.password} className="w-full rounded-xl h-10 sm:h-11 text-sm font-semibold shadow-lg shadow-primary/20 gap-2">
                  <UserPlus className="h-4 w-4" /> Create User
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="w-[calc(100%-2.5rem)] max-w-sm sm:max-w-md border-border/30 rounded-2xl p-0 overflow-hidden">
              <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold flex items-center gap-2">
                    <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-primary/15 flex items-center justify-center">
                      <Edit2 className="h-4 w-4 text-primary" />
                    </div>
                    Edit User
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Update user details</p>
                </DialogHeader>
              </div>
              <div className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-3 sm:space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</Label>
                  <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Full Name" className="rounded-xl h-9 sm:h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Username</Label>
                  <Input value={editForm.username} onChange={e => setEditForm(f => ({ ...f, username: e.target.value }))} placeholder="username" className="rounded-xl h-9 sm:h-10 font-mono" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</Label>
                    <Select
                      value={editForm.role}
                      onValueChange={v => setEditForm(f => ({ ...f, role: v as 'admin' | 'reseller' | 'banned' }))}
                      disabled={selectedUser?.username === currentUsername}
                    >
                      <SelectTrigger className="rounded-xl h-9 sm:h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="reseller">Reseller</SelectItem>
                        <SelectItem value="banned">Banned</SelectItem>
                      </SelectContent>
                    </Select>
                    {selectedUser?.username === currentUsername && (
                      <p className="text-[10px] text-muted-foreground">You cannot change your own role</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Balance</Label>
                    <Input type="number" min={0} value={editForm.balance} onChange={e => setEditForm(f => ({ ...f, balance: Number(e.target.value) || 0 }))} className="rounded-xl h-9 sm:h-10" />
                  </div>
                </div>
                <Button onClick={handleEditSubmit} className="w-full rounded-xl h-10 sm:h-11 text-sm font-semibold shadow-lg shadow-primary/20 gap-2">
                  <Edit2 className="h-4 w-4" /> Save Changes
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
            <DialogContent className="w-[calc(100%-2.5rem)] max-w-sm sm:max-w-md border-border/30 rounded-2xl p-0 overflow-hidden">
              <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold flex items-center gap-2">
                    <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-primary/15 flex items-center justify-center">
                      <Lock className="h-4 w-4 text-primary" />
                    </div>
                    Change Password
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{selectedUser?.username || 'Selected user'}</p>
                </DialogHeader>
              </div>
              <div className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-3 sm:space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Password</Label>
                  <div className="relative">
                    <Input
                      type={showNewPassword ? 'text' : 'password'}
                      value={passwordForm.newPassword}
                      onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
                      placeholder="New password"
                      className="rounded-xl h-9 sm:h-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(v => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={passwordForm.confirmPassword}
                      onChange={e => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))}
                      placeholder="Confirm password"
                      className="rounded-xl h-9 sm:h-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(v => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button onClick={handlePasswordSubmit} className="w-full rounded-xl h-10 sm:h-11 text-sm font-semibold shadow-lg shadow-primary/20 gap-2">
                  <Lock className="h-4 w-4" /> Update Password
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <DataTable
          data={filtered}
          columns={columns}
          page={page}
          onPageChange={setPage}
          itemsPerPage={15}
          emptyMessage="No users found"
          rowClassName={(u) => u.status === 'banned' ? 'text-destructive' : ''}
          mobileSummaryKeys={['name', 'password', 'action']}
          loading={tableLoading}
        />
      </div>
    </DashboardLayout>
  );
}
