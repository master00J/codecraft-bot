'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Users, Clock } from 'lucide-react';

type EmployeeOverview = {
  user_id: string;
  discord_tag: string | null;
  avatar_url: string | null;
  total_minutes: number;
  total_entries: number;
  last_clock_in_at: string | null;
  last_clock_out_at: string | null;
  active: boolean;
  active_since: string | null;
};

type TimeEntry = {
  id: string;
  clock_in_at: string;
  clock_out_at: string | null;
  status: 'active' | 'completed';
  duration_minutes: number;
};

const dateFormatter = new Intl.DateTimeFormat('nl-NL', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const formatDateTime = (value: string | null) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return dateFormatter.format(parsed);
};

const formatMinutes = (minutes: number) => {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  return `${hours}u ${mins}m`;
};

export default function TimeClockOverviewPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { toast } = useToast();

  const [employees, setEmployees] = useState<EmployeeOverview[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);

  const totals = useMemo(() => {
    const totalMinutes = employees.reduce((sum, emp) => sum + (emp.total_minutes || 0), 0);
    const activeCount = employees.filter((emp) => emp.active).length;
    return {
      totalMinutes,
      activeCount,
      employeeCount: employees.length,
    };
  }, [employees]);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/comcraft/guilds/${guildId}/timeclock/overview`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to load time clock data');
      }
      const data = await response.json();
      setEmployees(data.employees || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load time clock data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchEntries = async (userId: string) => {
    try {
      setLoadingEntries(true);
      const response = await fetch(
        `/api/comcraft/guilds/${guildId}/timeclock/entries?userId=${encodeURIComponent(userId)}`
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to load shifts');
      }
      const data = await response.json();
      setEntries(data.entries || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load shifts',
        variant: 'destructive',
      });
    } finally {
      setLoadingEntries(false);
    }
  };

  useEffect(() => {
    if (guildId) {
      fetchOverview();
    }
  }, [guildId]);

  useEffect(() => {
    if (selectedUserId) {
      fetchEntries(selectedUserId);
    } else {
      setEntries([]);
    }
  }, [selectedUserId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-gray-300">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading time clock...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Time Clock</h1>
        <p className="text-gray-400 mt-1">
          Overview of clock-ins and clock-outs per employee (last 30 days).
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-[#1a1f2e] border-gray-800 p-4">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-blue-400" />
            <div>
              <p className="text-sm text-gray-400">Employees</p>
              <p className="text-lg font-semibold text-white">{totals.employeeCount}</p>
            </div>
          </div>
        </Card>
        <Card className="bg-[#1a1f2e] border-gray-800 p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-green-400" />
            <div>
              <p className="text-sm text-gray-400">Currently clocked in</p>
              <p className="text-lg font-semibold text-white">{totals.activeCount}</p>
            </div>
          </div>
        </Card>
        <Card className="bg-[#1a1f2e] border-gray-800 p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-purple-400" />
            <div>
              <p className="text-sm text-gray-400">Total hours</p>
              <p className="text-lg font-semibold text-white">{formatMinutes(totals.totalMinutes)}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="bg-[#1a1f2e] border-gray-800 p-4">
        <h2 className="text-lg font-semibold text-white mb-4">Employees</h2>
        {employees.length === 0 ? (
          <div className="text-gray-400">No time clock entries found yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Shifts</TableHead>
                <TableHead>Last clock-in</TableHead>
                <TableHead>Last clock-out</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.user_id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {employee.avatar_url ? (
                        <img
                          src={employee.avatar_url}
                          alt={employee.discord_tag || employee.user_id}
                          className="h-8 w-8 rounded-full"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-300">
                          {employee.discord_tag?.[0] || '?'}
                        </div>
                      )}
                      <div>
                        <div className="text-white text-sm font-medium">
                          {employee.discord_tag || employee.user_id}
                        </div>
                        <div className="text-xs text-gray-400">{employee.user_id}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {employee.active ? (
                      <Badge className="bg-green-500/20 text-green-300 border border-green-500/30">
                        Clocked in
                      </Badge>
                    ) : (
                      <Badge className="bg-gray-500/20 text-gray-300 border border-gray-500/30">
                        Clocked out
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-white">{formatMinutes(employee.total_minutes)}</TableCell>
                  <TableCell className="text-white">{employee.total_entries}</TableCell>
                  <TableCell className="text-gray-300">{formatDateTime(employee.last_clock_in_at)}</TableCell>
                  <TableCell className="text-gray-300">{formatDateTime(employee.last_clock_out_at)}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        setSelectedUserId((current) =>
                          current === employee.user_id ? null : employee.user_id
                        )
                      }
                    >
                      {selectedUserId === employee.user_id ? 'Hide' : 'Details'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {selectedUserId && (
        <Card className="bg-[#1a1f2e] border-gray-800 p-4">
          <h2 className="text-lg font-semibold text-white mb-4">Recent shifts</h2>
          {loadingEntries ? (
            <div className="flex items-center text-gray-300">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading shifts...
            </div>
          ) : entries.length === 0 ? (
            <div className="text-gray-400">No shifts found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clock-in</TableHead>
                  <TableHead>Clock-out</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-gray-300">{formatDateTime(entry.clock_in_at)}</TableCell>
                    <TableCell className="text-gray-300">{formatDateTime(entry.clock_out_at)}</TableCell>
                    <TableCell className="text-white">{formatMinutes(entry.duration_minutes)}</TableCell>
                    <TableCell>
                      {entry.status === 'active' ? (
                        <Badge className="bg-green-500/20 text-green-300 border border-green-500/30">
                          Active
                        </Badge>
                      ) : (
                        <Badge className="bg-gray-500/20 text-gray-300 border border-gray-500/30">
                          Completed
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}
    </div>
  );
}
