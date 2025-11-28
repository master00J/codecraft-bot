'use client';

/**
 * Updates/Changelog Page
 * Displays all bot updates and new features
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Calendar, Sparkles, Zap, Shield, Bug, Search, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Navbar from '@/components/navbar';
import Footer from '@/components/footer';

interface UpdateItem {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
}

interface Update {
  id: string;
  version: string;
  title: string;
  release_date: string;
  description: string;
  type: string;
  is_major: boolean;
  featured_image_url?: string;
  items: UpdateItem[];
}

export default function UpdatesPage() {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [expandedUpdates, setExpandedUpdates] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchUpdates();
  }, []);

  const fetchUpdates = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/updates');
      const data = await response.json();
      if (data.success) {
        setUpdates(data.updates || []);
        // Expand first update by default
        if (data.updates && data.updates.length > 0) {
          setExpandedUpdates(new Set([data.updates[0].id]));
        }
      }
    } catch (error) {
      console.error('Error fetching updates:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleUpdate = (updateId: string) => {
    const newExpanded = new Set(expandedUpdates);
    if (newExpanded.has(updateId)) {
      newExpanded.delete(updateId);
    } else {
      newExpanded.add(updateId);
    }
    setExpandedUpdates(newExpanded);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'feature':
        return <Sparkles className="h-5 w-5" />;
      case 'improvement':
        return <Zap className="h-5 w-5" />;
      case 'bugfix':
        return <Bug className="h-5 w-5" />;
      case 'security':
        return <Shield className="h-5 w-5" />;
      default:
        return <Sparkles className="h-5 w-5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'feature':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'improvement':
        return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      case 'bugfix':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'security':
        return 'bg-red-500/10 text-red-600 border-red-500/20';
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  const filteredUpdates = updates.filter(update => {
    const matchesSearch = 
      update.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      update.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      update.version.toLowerCase().includes(searchQuery.toLowerCase()) ||
      update.items.some(item => 
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );

    const matchesFilter = filterType === 'all' || update.type === filterType;

    return matchesSearch && matchesFilter;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <div className="container mx-auto max-w-6xl px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary to-purple-600 mb-6">
            <Sparkles className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent mb-4">
            Updates & Changelog
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Stay up to date with the latest features, improvements, and fixes for ComCraft
          </p>
        </div>

        {/* Search and Filter */}
        <Card className="p-6 mb-8 border-2 shadow-lg">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search updates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="w-full md:w-48">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="feature">Features</SelectItem>
                  <SelectItem value="improvement">Improvements</SelectItem>
                  <SelectItem value="bugfix">Bug Fixes</SelectItem>
                  <SelectItem value="security">Security</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Updates List */}
        <div className="space-y-6">
          {filteredUpdates.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground text-lg">No updates found matching your criteria.</p>
            </Card>
          ) : (
            filteredUpdates.map((update) => (
              <Card
                key={update.id}
                className={`border-2 shadow-xl overflow-hidden transition-all hover:shadow-2xl ${
                  update.is_major ? 'border-primary/50 bg-gradient-to-br from-primary/5 to-purple-500/5' : ''
                }`}
              >
                {/* Update Header */}
                <div
                  className={`p-6 cursor-pointer ${
                    update.is_major ? 'bg-gradient-to-r from-primary/10 to-purple-500/10' : 'bg-muted/50'
                  }`}
                  onClick={() => toggleUpdate(update.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge
                          variant="outline"
                          className={`${getTypeColor(update.type)} flex items-center gap-2 px-3 py-1`}
                        >
                          {getTypeIcon(update.type)}
                          <span className="capitalize">{update.type}</span>
                        </Badge>
                        {update.is_major && (
                          <Badge className="bg-gradient-to-r from-primary to-purple-600 text-white">
                            Major Update
                          </Badge>
                        )}
                        <Badge variant="outline" className="font-mono">
                          v{update.version}
                        </Badge>
                      </div>
                      <h2 className="text-2xl font-bold mb-2">{update.title}</h2>
                      {update.description && (
                        <p className="text-muted-foreground mb-3">{update.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {formatDate(update.release_date)}
                        </div>
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          {update.items.length} {update.items.length === 1 ? 'change' : 'changes'}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                    >
                      {expandedUpdates.has(update.id) ? '▼' : '▶'}
                    </Button>
                  </div>
                </div>

                {/* Update Items (Expanded) */}
                {expandedUpdates.has(update.id) && (
                  <div className="p-6 border-t bg-background">
                    <div className="grid gap-4 md:grid-cols-2">
                      {update.items.map((item, index) => (
                        <Card
                          key={item.id}
                          className="p-4 border-2 hover:border-primary/50 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div className="text-2xl shrink-0">
                              {item.icon || '✨'}
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg mb-1">{item.title}</h3>
                              {item.description && (
                                <p className="text-sm text-muted-foreground">{item.description}</p>
                              )}
                              {item.category && (
                                <Badge variant="outline" className="mt-2 text-xs">
                                  {item.category}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>

        {/* Footer Info */}
        <Card className="mt-12 p-6 text-center border-2 bg-gradient-to-r from-primary/5 to-purple-500/5">
          <p className="text-muted-foreground">
            Want to suggest a feature?{' '}
            <a href="/contact" className="text-primary hover:underline font-semibold">
              Contact us
            </a>
            {' '}or{' '}
            <a href="/comcraft/dashboard" className="text-primary hover:underline font-semibold">
              submit a suggestion
            </a>
            {' '}in your dashboard!
          </p>
        </Card>
        </div>
      </div>
      <Footer />
    </>
  );
}

