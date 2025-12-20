'use client';

/**
 * ComCraft Vouches/Reputation Management Dashboard
 * View and manage user reputation ratings in your Discord server
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Link } from '@/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, ArrowLeft, Star, Trash2, Search, TrendingUp, Users, Award } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Vouch {
  id: string;
  guild_id: string;
  from_user_id: string;
  to_user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

interface UserStats {
  userId: string;
  totalVouches: number;
  averageRating: number;
  ratingBreakdown: Record<number, number>;
}

export default function VouchesDashboard() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [vouches, setVouches] = useState<Vouch[]>([]);
  const [filteredVouches, setFilteredVouches] = useState<Vouch[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vouchToDelete, setVouchToDelete] = useState<Vouch | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [userStats, setUserStats] = useState<Map<string, UserStats>>(new Map());

  useEffect(() => {
    if (guildId) {
      fetchVouches();
    }
  }, [guildId]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredVouches(vouches);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredVouches(
        vouches.filter(
          (v) =>
            v.from_user_id.toLowerCase().includes(query) ||
            v.to_user_id.toLowerCase().includes(query) ||
            v.comment?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, vouches]);

  useEffect(() => {
    calculateUserStats();
  }, [vouches]);

  const fetchVouches = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/vouches`);
      const data = await response.json();

      if (data.vouches) {
        setVouches(data.vouches);
        setFilteredVouches(data.vouches);
      }
    } catch (error) {
      console.error('Error fetching vouches:', error);
      toast({
        title: 'Error',
        description: 'Failed to load vouches.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateUserStats = () => {
    const stats = new Map<string, UserStats>();

    vouches.forEach((vouch) => {
      const userId = vouch.to_user_id;
      
      if (!stats.has(userId)) {
        stats.set(userId, {
          userId,
          totalVouches: 0,
          averageRating: 0,
          ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        });
      }

      const userStat = stats.get(userId)!;
      userStat.totalVouches++;
      userStat.ratingBreakdown[vouch.rating]++;
    });

    // Calculate averages
    stats.forEach((stat) => {
      const totalStars = Object.entries(stat.ratingBreakdown).reduce(
        (sum, [rating, count]) => sum + parseInt(rating) * count,
        0
      );
      stat.averageRating = totalStars / stat.totalVouches;
    });

    setUserStats(stats);
  };

  const handleDelete = async () => {
    if (!vouchToDelete) return;

    setDeleting(true);
    try {
      const response = await fetch(
        `/api/comcraft/guilds/${guildId}/vouches?id=${vouchToDelete.id}`,
        { method: 'DELETE' }
      );

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Vouch deleted successfully!',
        });
        await fetchVouches();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to delete vouch.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting vouch:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setVouchToDelete(null);
    }
  };

  const openDeleteDialog = (vouch: Vouch) => {
    setVouchToDelete(vouch);
    setDeleteDialogOpen(true);
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${
              i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
            }`}
          />
        ))}
        <span className="ml-1 text-sm font-medium">{rating}/5</span>
      </div>
    );
  };

  const topUsers = Array.from(userStats.values())
    .sort((a, b) => {
      if (Math.abs(b.averageRating - a.averageRating) < 0.01) {
        return b.totalVouches - a.totalVouches;
      }
      return b.averageRating - a.averageRating;
    })
    .slice(0, 5);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto max-w-7xl px-4 py-8 space-y-6">
        <Button asChild variant="ghost" className="w-fit hover:bg-primary/10">
          <Link href={`/comcraft/dashboard/${guildId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Overview
          </Link>
        </Button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              Reputation Management
            </h1>
            <p className="text-muted-foreground mt-2">
              View and manage user reputation ratings in your server
            </p>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-6 border-primary/20 bg-card/50 backdrop-blur">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Star className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Vouches</p>
                <p className="text-2xl font-bold">{vouches.length}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 border-primary/20 bg-card/50 backdrop-blur">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500/10 rounded-lg">
                <Users className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Users with Reputation</p>
                <p className="text-2xl font-bold">{userStats.size}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 border-primary/20 bg-card/50 backdrop-blur">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-500/10 rounded-lg">
                <TrendingUp className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Average Rating</p>
                <p className="text-2xl font-bold">
                  {vouches.length > 0
                    ? (
                        vouches.reduce((sum, v) => sum + v.rating, 0) / vouches.length
                      ).toFixed(1)
                    : '0.0'}
                  /5
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Top Rated Users */}
        {topUsers.length > 0 && (
          <Card className="p-6 border-primary/20 bg-card/50 backdrop-blur">
            <div className="flex items-center gap-2 mb-4">
              <Award className="h-5 w-5 text-yellow-500" />
              <h2 className="text-xl font-semibold">Top Rated Users</h2>
            </div>
            <div className="space-y-3">
              {topUsers.map((user, index) => (
                <div
                  key={user.userId}
                  className="flex items-center justify-between p-3 bg-background/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={index === 0 ? 'default' : 'secondary'}>
                      #{index + 1}
                    </Badge>
                    <span className="font-mono text-sm">{user.userId}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {renderStars(Math.round(user.averageRating))}
                    <Badge variant="outline">{user.totalVouches} vouches</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Vouches Table */}
        <Card className="p-6 border-primary/20 bg-card/50 backdrop-blur">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">All Vouches</h2>
            <div className="flex items-center gap-2 max-w-sm">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by user ID or comment..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-xs"
              />
            </div>
          </div>

          {filteredVouches.length === 0 ? (
            <div className="text-center py-12">
              <Star className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {vouches.length === 0
                  ? 'No vouches yet. Users can vouch for each other using /vouch command.'
                  : 'No vouches match your search.'}
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>From User</TableHead>
                    <TableHead>To User</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Comment</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVouches.map((vouch) => (
                    <TableRow key={vouch.id}>
                      <TableCell className="font-mono text-sm">
                        {vouch.from_user_id}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {vouch.to_user_id}
                      </TableCell>
                      <TableCell>{renderStars(vouch.rating)}</TableCell>
                      <TableCell className="max-w-md">
                        {vouch.comment ? (
                          <span className="text-sm text-muted-foreground">
                            {vouch.comment.length > 50
                              ? `${vouch.comment.substring(0, 50)}...`
                              : vouch.comment}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">
                            No comment
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(vouch.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteDialog(vouch)}
                          className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vouch</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this vouch? This action cannot be undone.
              {vouchToDelete && (
                <div className="mt-4 p-3 bg-muted rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Rating:</span>
                    {renderStars(vouchToDelete.rating)}
                  </div>
                  {vouchToDelete.comment && (
                    <div>
                      <span className="text-sm font-medium">Comment:</span>
                      <p className="text-sm text-muted-foreground mt-1">
                        {vouchToDelete.comment}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-500 hover:bg-red-600"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
