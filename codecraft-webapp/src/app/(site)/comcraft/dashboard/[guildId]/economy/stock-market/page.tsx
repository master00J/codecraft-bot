'use client';

/**
 * Stock Market Management Dashboard
 * Configure stocks, market settings, view charts, activity logs, and manage bulk operations
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Link } from '@/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

export default function StockMarketPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { toast } = useToast();
  
  const [stocks, setStocks] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Price chart state
  const [selectedStockForChart, setSelectedStockForChart] = useState<string>('');
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [chartLoading, setChartLoading] = useState(false);

  // Activity log state
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Bulk operations state
  const [selectedStocks, setSelectedStocks] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<'update' | 'delete' | null>(null);
  const [bulkUpdateData, setBulkUpdateData] = useState({
    status: 'active',
    volatility: 5
  });

  // New stock form
  const [newStock, setNewStock] = useState({
    symbol: '',
    name: '',
    description: '',
    emoji: '📊',
    base_price: 100,
    volatility: 5,
    total_shares: 1000000
  });

  // Edit stock form
  const [editingStock, setEditingStock] = useState<any>(null);

  // Market events state
  const [activeEvents, setActiveEvents] = useState<any[]>([]);
  const [newEvent, setNewEvent] = useState({
    event_type: 'news',
    title: '',
    description: '',
    stock_id: null as string | null,
    price_multiplier: 1.0,
    price_change_percentage: 0,
    duration_minutes: null as number | null
  });

  // Orders state
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [executedOrdersCount, setExecutedOrdersCount] = useState(0);
  const [totalOrdersCount, setTotalOrdersCount] = useState(0);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  useEffect(() => {
    if (guildId) {
      fetchData();
    }
  }, [guildId]);

  useEffect(() => {
    if (selectedStockForChart && guildId) {
      fetchPriceHistory();
    }
  }, [selectedStockForChart, guildId]);

  const fetchData = async () => {
    try {
      const [marketRes, eventsRes, ordersRes] = await Promise.all([
        fetch(`/api/comcraft/guilds/${guildId}/economy/stock-market`),
        fetch(`/api/comcraft/guilds/${guildId}/economy/stock-market?action=events`),
        fetch(`/api/comcraft/guilds/${guildId}/economy/stock-market?action=orders_stats`)
      ]);

      if (marketRes.ok) {
        const data = await marketRes.json();
        setStocks(data.stocks || []);
        setConfig(data.config || {});
        if (data.stocks && data.stocks.length > 0 && !selectedStockForChart) {
          setSelectedStockForChart(data.stocks[0].id);
        }
      }

      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setActiveEvents(eventsData.events || []);
      }

      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setPendingOrdersCount(ordersData.pending || 0);
        setExecutedOrdersCount(ordersData.executed || 0);
        setTotalOrdersCount(ordersData.total || 0);
        setRecentOrders(ordersData.recent || []);
      }
    } catch (error) {
      console.error('Error fetching stock market data:', error);
      toast({
        title: 'Failed to load data',
        description: 'We could not load the stock market data. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPriceHistory = async () => {
    if (!selectedStockForChart) return;
    
    setChartLoading(true);
    try {
      const response = await fetch(
        `/api/comcraft/guilds/${guildId}/economy/stock-market?action=price_history&stock_id=${selectedStockForChart}&limit=100`
      );
      if (response.ok) {
        const data = await response.json();
        const formatted = (data.priceHistory || []).map((entry: any) => ({
          price: parseFloat(entry.price || 0),
          time: new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          date: new Date(entry.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        }));
        setPriceHistory(formatted);
      }
    } catch (error) {
      console.error('Error fetching price history:', error);
    } finally {
      setChartLoading(false);
    }
  };

  const fetchActivityLog = async () => {
    setActivityLoading(true);
    try {
      const response = await fetch(
        `/api/comcraft/guilds/${guildId}/economy/stock-market?action=activity_log&limit=100`
      );
      if (response.ok) {
        const data = await response.json();
        setActivityLog(data.transactions || []);
      }
    } catch (error) {
      console.error('Error fetching activity log:', error);
      toast({
        title: 'Failed to load activity log',
        description: 'We could not load the activity log. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setActivityLoading(false);
    }
  };

  const createStock = async () => {
    if (!newStock.symbol || !newStock.name || !newStock.base_price) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in Symbol, Name, and Base Price.',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/economy/stock-market`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_stock',
          ...newStock
        })
      });

      if (response.ok) {
        toast({
          title: 'Stock created',
          description: `Stock "${newStock.symbol}" has been created successfully.`,
        });
        fetchData();
        setNewStock({
          symbol: '',
          name: '',
          description: '',
          emoji: '📊',
          base_price: 100,
          volatility: 5,
          total_shares: 1000000
        });
      } else {
        const errorData = await response.json();
        toast({
          title: 'Create failed',
          description: errorData.error || 'We could not create this stock. Please try again.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Create failed',
        description: 'We could not create this stock. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const updateStock = async (stockId: string, updates: any) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/economy/stock-market`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_stock',
          stock_id: stockId,
          ...updates
        })
      });

      if (response.ok) {
        toast({
          title: 'Stock updated',
          description: 'Stock has been updated successfully.',
        });
        fetchData();
        setEditingStock(null);
        if (stockId === selectedStockForChart) {
          fetchPriceHistory();
        }
      } else {
        const errorData = await response.json();
        toast({
          title: 'Update failed',
          description: errorData.error || 'Failed to update stock.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Update failed',
        description: 'Failed to update stock.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteStock = async (stockId: string) => {
    if (!confirm('Are you sure you want to delete this stock? This cannot be undone!')) {
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/economy/stock-market`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_stock',
          stock_id: stockId
        })
      });

      if (response.ok) {
        toast({
          title: 'Stock deleted',
          description: 'Stock has been deleted successfully.',
        });
        fetchData();
        if (stockId === selectedStockForChart && stocks.length > 1) {
          const remaining = stocks.filter(s => s.id !== stockId);
          if (remaining.length > 0) {
            setSelectedStockForChart(remaining[0].id);
          }
        }
      } else {
        toast({
          title: 'Delete failed',
          description: 'Failed to delete stock.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: 'Failed to delete stock.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/economy/stock-market`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_config',
          ...config
        })
      });

      if (response.ok) {
        toast({
          title: 'Configuration saved',
          description: 'Market configuration has been updated successfully.',
        });
        fetchData();
      } else {
        toast({
          title: 'Save failed',
          description: 'Failed to save configuration.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Save failed',
        description: 'Failed to save configuration.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBulkUpdate = async () => {
    if (selectedStocks.length === 0) {
      toast({
        title: 'No stocks selected',
        description: 'Please select at least one stock.',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/economy/stock-market`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_update',
          stock_ids: selectedStocks,
          updates: bulkUpdateData
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Bulk update successful',
          description: `Updated ${data.updated} stock(s) successfully.`,
        });
        fetchData();
        setSelectedStocks([]);
        setBulkAction(null);
      } else {
        toast({
          title: 'Bulk update failed',
          description: 'Failed to update stocks.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Bulk update failed',
        description: 'Failed to update stocks.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedStocks.length === 0) {
      toast({
        title: 'No stocks selected',
        description: 'Please select at least one stock.',
        variant: 'destructive'
      });
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedStocks.length} stock(s)? This cannot be undone!`)) {
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/economy/stock-market`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_delete',
          stock_ids: selectedStocks
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Bulk delete successful',
          description: `Deleted ${data.deleted} stock(s) successfully.`,
        });
        fetchData();
        setSelectedStocks([]);
        setBulkAction(null);
      } else {
        toast({
          title: 'Bulk delete failed',
          description: 'Failed to delete stocks.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Bulk delete failed',
        description: 'Failed to delete stocks.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/economy/stock-market`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'export' })
      });

      if (response.ok) {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data.stocks, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `stocks-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast({
          title: 'Export successful',
          description: `Exported ${data.stocks.length} stock(s).`,
        });
      } else {
        toast({
          title: 'Export failed',
          description: 'Failed to export stocks.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Failed to export stocks.',
        variant: 'destructive'
      });
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!Array.isArray(data)) {
        toast({
          title: 'Invalid file',
          description: 'The file must contain an array of stocks.',
          variant: 'destructive'
        });
        return;
      }

      setSaving(true);
      const response = await fetch(`/api/comcraft/guilds/${guildId}/economy/stock-market`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import',
          stocks: data
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: 'Import successful',
          description: `Imported ${result.imported} stock(s) successfully.`,
        });
        fetchData();
      } else {
        toast({
          title: 'Import failed',
          description: 'Failed to import stocks.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Import failed',
        description: 'Failed to parse the file. Please check the format.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
      event.target.value = '';
    }
  };

  const toggleStockSelection = (stockId: string) => {
    setSelectedStocks(prev => 
      prev.includes(stockId) 
        ? prev.filter(id => id !== stockId)
        : [...prev, stockId]
    );
  };

  const selectAllStocks = () => {
    if (selectedStocks.length === stocks.length) {
      setSelectedStocks([]);
    } else {
      setSelectedStocks(stocks.map(s => s.id));
    }
  };

  const createMarketEvent = async () => {
    if (!newEvent.title) {
      toast({
        title: 'Missing title',
        description: 'Please provide an event title.',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/economy/stock-market`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_event',
          ...newEvent
        })
      });

      if (response.ok) {
        toast({
          title: 'Event created',
          description: 'Market event has been created successfully.',
        });
        fetchData();
        setNewEvent({
          event_type: 'news',
          title: '',
          description: '',
          stock_id: null,
          price_multiplier: 1.0,
          price_change_percentage: 0,
          duration_minutes: null
        });
      } else {
        const errorData = await response.json();
        toast({
          title: 'Create failed',
          description: errorData.error || 'Failed to create event.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Create failed',
        description: 'Failed to create event.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const deactivateEvent = async (eventId: string) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/economy/stock-market`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deactivate_event',
          event_id: eventId
        })
      });

      if (response.ok) {
        toast({
          title: 'Event deactivated',
          description: 'Market event has been deactivated.',
        });
        fetchData();
      } else {
        toast({
          title: 'Deactivate failed',
          description: 'Failed to deactivate event.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Deactivate failed',
        description: 'Failed to deactivate event.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto max-w-7xl px-4 py-8 space-y-6">
        <Button asChild variant="ghost" className="w-fit hover:bg-primary/10">
          <Link href={`/comcraft/dashboard/${guildId}`}>← Back to Overview</Link>
        </Button>

        <Card className="border-2 shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-teal-500/10 p-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl" />
                  <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-2xl font-bold border-4 border-background shadow-lg">
                    📈
                  </div>
                </div>
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-2">
                    Stock Market
                  </h1>
                  <p className="text-muted-foreground max-w-xl">
                    Manage stocks, configure market settings, view charts, activity logs, and perform bulk operations.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Badge className="bg-green-600 px-4 py-2 border-0">
                  {stocks.length} Stock{stocks.length !== 1 ? 's' : ''}
                </Badge>
                <Badge variant="outline" className="px-4 py-2">
                  {config.market_enabled !== false ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
            </div>
          </div>
        </Card>

        <Tabs defaultValue="stocks" className="space-y-6">
          <TabsList className="w-full grid grid-cols-8 bg-muted/50 p-2 rounded-lg">
            <TabsTrigger value="stocks">Stocks</TabsTrigger>
            <TabsTrigger value="create">Create</TabsTrigger>
            <TabsTrigger value="charts">Charts</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="bulk">Bulk</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="config">Config</TabsTrigger>
          </TabsList>

          {/* Stocks List Tab */}
          <TabsContent value="stocks" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6">📊 All Stocks</h2>
              
              {stocks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No stocks created yet.
                  <br />
                  <span className="text-sm">Create your first stock in the "Create" tab!</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {stocks.map((stock) => {
                    const change = parseFloat(stock.current_price) - parseFloat(stock.base_price);
                    const changePercent = ((change / parseFloat(stock.base_price)) * 100).toFixed(2);
                    const sign = change >= 0 ? '+' : '';
                    const isUp = change >= 0;

                    return (
                      <Card key={stock.id} className="p-4 border-2">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4 flex-1">
                            <div className="text-4xl">{stock.emoji || '📊'}</div>
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-lg font-bold">{stock.symbol}</h3>
                                <span className="text-sm text-muted-foreground">- {stock.name}</span>
                                <Badge variant={stock.status === 'active' ? 'default' : 'secondary'}>
                                  {stock.status}
                                </Badge>
                              </div>
                              {stock.description && (
                                <p className="text-sm text-muted-foreground mb-3">{stock.description}</p>
                              )}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Current Price:</span>
                                  <p className="font-bold">{parseFloat(stock.current_price).toFixed(2)} coins</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Base Price:</span>
                                  <p className="font-bold">{parseFloat(stock.base_price).toFixed(2)} coins</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Change:</span>
                                  <p className={`font-bold ${isUp ? 'text-green-500' : 'text-red-500'}`}>
                                    {sign}{changePercent}% ({sign}{change.toFixed(2)})
                                  </p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Volatility:</span>
                                  <p className="font-bold">{stock.volatility}%</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Available:</span>
                                  <p className="font-bold">{stock.available_shares.toLocaleString()} / {stock.total_shares.toLocaleString()}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingStock(stock)}
                            >
                              ✏️ Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deleteStock(stock.id)}
                              disabled={saving}
                            >
                              🗑️ Delete
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Create Stock Tab */}
          <TabsContent value="create" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6">➕ Create New Stock</h2>
              
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Stock Symbol *</Label>
                    <Input
                      value={newStock.symbol}
                      onChange={(e) => setNewStock({...newStock, symbol: e.target.value.toUpperCase()})}
                      placeholder="COMCRAFT"
                      maxLength={10}
                    />
                    <p className="text-xs text-muted-foreground">
                      Unique identifier (max 10 characters, uppercase)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Stock Name *</Label>
                    <Input
                      value={newStock.name}
                      onChange={(e) => setNewStock({...newStock, name: e.target.value})}
                      placeholder="ComCraft Corporation"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Description</Label>
                    <Input
                      value={newStock.description}
                      onChange={(e) => setNewStock({...newStock, description: e.target.value})}
                      placeholder="A leading Discord bot platform company"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Emoji</Label>
                    <Input
                      value={newStock.emoji}
                      onChange={(e) => setNewStock({...newStock, emoji: e.target.value})}
                      placeholder="📊"
                      maxLength={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Base Price (coins) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={newStock.base_price}
                      onChange={(e) => setNewStock({...newStock, base_price: parseFloat(e.target.value) || 0})}
                      placeholder="100.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Volatility (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="100"
                      value={newStock.volatility}
                      onChange={(e) => setNewStock({...newStock, volatility: parseFloat(e.target.value) || 5})}
                      placeholder="5.0"
                    />
                    <p className="text-xs text-muted-foreground">
                      Price fluctuation range (1-100%)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Total Shares</Label>
                    <Input
                      type="number"
                      step="1000"
                      min="1000"
                      value={newStock.total_shares}
                      onChange={(e) => setNewStock({...newStock, total_shares: parseInt(e.target.value) || 1000000})}
                      placeholder="1000000"
                    />
                  </div>
                </div>

                <Button onClick={createStock} disabled={saving} className="w-full">
                  {saving ? 'Creating...' : '➕ Create Stock'}
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* Price Charts Tab */}
          <TabsContent value="charts" className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">📈 Price Charts</h2>
                <div className="flex items-center gap-3">
                  <Select value={selectedStockForChart} onValueChange={setSelectedStockForChart}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select a stock" />
                    </SelectTrigger>
                    <SelectContent>
                      {stocks.map((stock) => (
                        <SelectItem key={stock.id} value={stock.id}>
                          {stock.emoji || '📊'} {stock.symbol} - {stock.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={fetchPriceHistory} variant="outline" size="sm">
                    🔄 Refresh
                  </Button>
                </div>
              </div>

              {chartLoading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : priceHistory.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No price history available yet.
                  <br />
                  <span className="text-sm">Price history will appear after the first price update.</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={priceHistory}>
                      <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis 
                        dataKey="time" 
                        stroke="#9ca3af"
                        tick={{ fill: '#9ca3af' }}
                      />
                      <YAxis 
                        stroke="#9ca3af"
                        tick={{ fill: '#9ca3af' }}
                        label={{ value: 'Price (coins)', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                        labelStyle={{ color: '#f3f4f6' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="price" 
                        stroke="#10b981" 
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorPrice)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                  
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-muted-foreground">Current Price</p>
                      <p className="text-xl font-bold text-green-500">
                        {priceHistory[priceHistory.length - 1]?.price.toFixed(2) || 'N/A'} coins
                      </p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-muted-foreground">Highest</p>
                      <p className="text-xl font-bold">
                        {Math.max(...priceHistory.map(p => p.price)).toFixed(2)} coins
                      </p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-muted-foreground">Lowest</p>
                      <p className="text-xl font-bold">
                        {Math.min(...priceHistory.map(p => p.price)).toFixed(2)} coins
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Activity Log Tab */}
          <TabsContent value="activity" className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">📜 Market Activity Log</h2>
                <Button onClick={fetchActivityLog} variant="outline" size="sm" disabled={activityLoading}>
                  {activityLoading ? 'Loading...' : '🔄 Refresh'}
                </Button>
              </div>

              {activityLoading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : activityLog.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No activity yet.
                  <br />
                  <span className="text-sm">Trading activity will appear here once users start buying and selling stocks.</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {activityLog.map((tx: any) => {
                    const stock = tx.stock;
                    const isBuy = tx.transaction_type === 'buy';
                    const date = new Date(tx.created_at).toLocaleString('en-US');

                    return (
                      <Card key={tx.id} className="p-4 border">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="text-2xl">{isBuy ? '💰' : '💸'}</div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant={isBuy ? 'default' : 'secondary'}>
                                  {isBuy ? 'BUY' : 'SELL'}
                                </Badge>
                                <span className="font-bold">{stock?.symbol || 'N/A'}</span>
                                <span className="text-sm text-muted-foreground">- {stock?.name || 'Unknown'}</span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {tx.shares} shares @ {parseFloat(tx.price_per_share).toFixed(2)} coins
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Total: {parseFloat(tx.total_cost).toLocaleString()} coins
                              </p>
                              {!isBuy && tx.profit_loss !== null && (
                                <p className={`text-sm font-bold ${parseFloat(tx.profit_loss) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                  P/L: {parseFloat(tx.profit_loss) >= 0 ? '+' : ''}{parseFloat(tx.profit_loss).toLocaleString()} coins
                                  ({parseFloat(tx.profit_loss_percentage) >= 0 ? '+' : ''}{parseFloat(tx.profit_loss_percentage).toFixed(2)}%)
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground text-right">
                            <p>{date}</p>
                            <p className="mt-1">User: <span className="font-mono">{tx.user_id.slice(0, 8)}...</span></p>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Bulk Operations Tab */}
          <TabsContent value="bulk" className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">⚡ Bulk Operations</h2>
                <div className="flex gap-2">
                  <Button onClick={handleExport} variant="outline" size="sm">
                    📥 Export Stocks
                  </Button>
                  <label className="cursor-pointer">
                    <span className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3">
                      📤 Import Stocks
                    </span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImport}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {stocks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No stocks available for bulk operations.
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Button onClick={selectAllStocks} variant="outline" size="sm">
                        {selectedStocks.length === stocks.length ? 'Deselect All' : 'Select All'}
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        {selectedStocks.length} of {stocks.length} selected
                      </span>
                    </div>
                    {selectedStocks.length > 0 && (
                      <div className="flex gap-2">
                        <Button onClick={() => setBulkAction('update')} variant="outline" size="sm">
                          ✏️ Bulk Update
                        </Button>
                        <Button onClick={() => setBulkAction('delete')} variant="destructive" size="sm">
                          🗑️ Bulk Delete
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {stocks.map((stock) => (
                      <Card key={stock.id} className="p-3 border">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedStocks.includes(stock.id)}
                            onChange={() => toggleStockSelection(stock.id)}
                            className="w-4 h-4"
                          />
                          <div className="text-2xl">{stock.emoji || '📊'}</div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold">{stock.symbol}</span>
                              <span className="text-sm text-muted-foreground">- {stock.name}</span>
                              <Badge variant={stock.status === 'active' ? 'default' : 'secondary'}>
                                {stock.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Price: {parseFloat(stock.current_price).toFixed(2)} coins
                            </p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {bulkAction === 'update' && selectedStocks.length > 0 && (
                    <Card className="p-4 border-2 border-primary/50">
                      <h3 className="font-bold mb-4">Bulk Update Settings</h3>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Status</Label>
                          <Select value={bulkUpdateData.status} onValueChange={(v) => setBulkUpdateData({...bulkUpdateData, status: v})}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="suspended">Suspended</SelectItem>
                              <SelectItem value="delisted">Delisted</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Volatility (%)</Label>
                          <Input
                            type="number"
                            step="0.1"
                            min="0.1"
                            max="100"
                            value={bulkUpdateData.volatility}
                            onChange={(e) => setBulkUpdateData({...bulkUpdateData, volatility: parseFloat(e.target.value) || 5})}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={handleBulkUpdate} disabled={saving}>
                            {saving ? 'Updating...' : '💾 Apply Update'}
                          </Button>
                          <Button onClick={() => setBulkAction(null)} variant="outline">
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </Card>
                  )}

                  {bulkAction === 'delete' && selectedStocks.length > 0 && (
                    <Card className="p-4 border-2 border-destructive/50">
                      <h3 className="font-bold mb-4 text-destructive">Confirm Bulk Delete</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        You are about to delete {selectedStocks.length} stock(s). This action cannot be undone.
                      </p>
                      <div className="flex gap-2">
                        <Button onClick={handleBulkDelete} variant="destructive" disabled={saving}>
                          {saving ? 'Deleting...' : '🗑️ Confirm Delete'}
                        </Button>
                        <Button onClick={() => setBulkAction(null)} variant="outline">
                          Cancel
                        </Button>
                      </div>
                    </Card>
                  )}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Market Events Tab */}
          <TabsContent value="events" className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">📰 Market Events</h2>
                <Button onClick={fetchData} variant="outline" size="sm">
                  🔄 Refresh
                </Button>
              </div>

              <div className="space-y-4">
                <Card className="p-4 border-2 border-primary/50">
                  <h3 className="font-bold mb-4">Create Market Event</h3>
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Event Type</Label>
                        <Select defaultValue="news" onValueChange={(v) => setNewEvent({...newEvent, event_type: v})}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ipo">🚀 IPO (Initial Public Offering)</SelectItem>
                            <SelectItem value="crash">💥 Market Crash</SelectItem>
                            <SelectItem value="boom">📈 Market Boom</SelectItem>
                            <SelectItem value="split">✂️ Stock Split</SelectItem>
                            <SelectItem value="dividend">💰 Dividend Announcement</SelectItem>
                            <SelectItem value="news">📰 News Event</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Stock (Optional)</Label>
                        <Select onValueChange={(v) => setNewEvent({...newEvent, stock_id: v === 'all' ? null : v})}>
                          <SelectTrigger>
                            <SelectValue placeholder="All stocks" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Stocks</SelectItem>
                            {stocks.map((stock) => (
                              <SelectItem key={stock.id} value={stock.id}>
                                {stock.emoji || '📊'} {stock.symbol} - {stock.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label>Title *</Label>
                        <Input
                          value={newEvent.title}
                          onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                          placeholder="Market Crash: All Stocks Drop 50%"
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label>Description</Label>
                        <Input
                          value={newEvent.description}
                          onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                          placeholder="A major market crash has occurred..."
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Price Multiplier</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max="10"
                          value={newEvent.price_multiplier}
                          onChange={(e) => setNewEvent({...newEvent, price_multiplier: parseFloat(e.target.value) || 1.0})}
                          placeholder="1.0"
                        />
                        <p className="text-xs text-muted-foreground">
                          Multiply price by this (e.g., 0.5 = 50% drop, 2.0 = 100% increase)
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Price Change %</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="-100"
                          max="100"
                          value={newEvent.price_change_percentage}
                          onChange={(e) => setNewEvent({...newEvent, price_change_percentage: parseFloat(e.target.value) || 0})}
                          placeholder="0"
                        />
                        <p className="text-xs text-muted-foreground">
                          Direct percentage change (alternative to multiplier)
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Duration (minutes)</Label>
                        <Input
                          type="number"
                          min="1"
                          value={newEvent.duration_minutes}
                          onChange={(e) => setNewEvent({...newEvent, duration_minutes: parseInt(e.target.value) || null})}
                          placeholder="Leave empty for permanent"
                        />
                        <p className="text-xs text-muted-foreground">
                          How long the event lasts (empty = permanent)
                        </p>
                      </div>
                    </div>

                    <Button onClick={createMarketEvent} disabled={saving} className="w-full">
                      {saving ? 'Creating...' : '📰 Create Market Event'}
                    </Button>
                  </div>
                </Card>

                <div>
                  <h3 className="font-bold mb-4">Active Events</h3>
                  {activeEvents.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No active market events.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activeEvents.map((event: any) => {
                        const stock = event.stock;
                        const eventEmojis: Record<string, string> = {
                          'ipo': '🚀',
                          'crash': '💥',
                          'boom': '📈',
                          'split': '✂️',
                          'dividend': '💰',
                          'news': '📰'
                        };

                        return (
                          <Card key={event.id} className="p-4 border">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-2xl">{eventEmojis[event.event_type] || '📊'}</span>
                                  <h4 className="font-bold">{event.title}</h4>
                                  {stock && (
                                    <Badge variant="outline">
                                      {stock.emoji || '📊'} {stock.symbol}
                                    </Badge>
                                  )}
                                </div>
                                {event.description && (
                                  <p className="text-sm text-muted-foreground mb-2">{event.description}</p>
                                )}
                                <div className="flex gap-4 text-sm">
                                  {event.price_multiplier !== 1.0 && (
                                    <span>
                                      <span className="text-muted-foreground">Multiplier:</span>{' '}
                                      <span className="font-bold">{event.price_multiplier}x</span>
                                    </span>
                                  )}
                                  {event.price_change_percentage !== 0 && (
                                    <span>
                                      <span className="text-muted-foreground">Change:</span>{' '}
                                      <span className="font-bold">
                                        {event.price_change_percentage > 0 ? '+' : ''}{event.price_change_percentage}%
                                      </span>
                                    </span>
                                  )}
                                  {event.ends_at && (
                                    <span>
                                      <span className="text-muted-foreground">Ends:</span>{' '}
                                      <span className="font-bold">
                                        {new Date(event.ends_at).toLocaleString('en-US')}
                                      </span>
                                    </span>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => deactivateEvent(event.id)}
                                disabled={saving}
                              >
                                Deactivate
                              </Button>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Orders Management Tab */}
          <TabsContent value="orders" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6">📋 Orders Overview</h2>
              
              <div className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <Card className="p-4">
                    <p className="text-muted-foreground mb-1">Pending Orders</p>
                    <p className="text-2xl font-bold">{pendingOrdersCount}</p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-muted-foreground mb-1">Executed Today</p>
                    <p className="text-2xl font-bold">{executedOrdersCount}</p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-muted-foreground mb-1">Total Orders</p>
                    <p className="text-2xl font-bold">{totalOrdersCount}</p>
                  </Card>
                </div>

                <div>
                  <h3 className="font-bold mb-4">Recent Orders</h3>
                  {recentOrders.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No orders found.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {recentOrders.map((order: any) => {
                        const stock = order.stock;
                        const orderTypeNames: Record<string, string> = {
                          'limit_buy': '📈 Limit Buy',
                          'limit_sell': '📉 Limit Sell',
                          'stop_loss': '🛑 Stop Loss',
                          'stop_profit': '🎯 Stop Profit'
                        };

                        return (
                          <Card key={order.id} className="p-3 border">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="text-xl">{orderTypeNames[order.order_type] || order.order_type}</span>
                                <div>
                                  <div className="font-bold">{stock?.symbol || 'N/A'}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {order.shares} shares @ {parseFloat(order.target_price).toFixed(2)} coins
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <Badge variant={order.status === 'pending' ? 'default' : 'secondary'}>
                                  {order.status}
                                </Badge>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {new Date(order.created_at).toLocaleDateString('en-US')}
                                </p>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Market Config Tab */}
          <TabsContent value="config" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6">⚙️ Market Configuration</h2>
              
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config.market_enabled !== false}
                      onChange={(e) => setConfig({...config, market_enabled: e.target.checked})}
                      className="w-4 h-4"
                    />
                    <Label>Enable Stock Market</Label>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Trading Fee (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="10"
                        value={config.trading_fee_percentage ?? 0}
                        onChange={(e) => setConfig({...config, trading_fee_percentage: parseFloat(e.target.value) || 0})}
                      />
                      <p className="text-xs text-muted-foreground">
                        Transaction fee percentage (0-10%)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Price Update Interval (minutes)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="60"
                        value={config.price_update_interval_minutes ?? 15}
                        onChange={(e) => setConfig({...config, price_update_interval_minutes: parseInt(e.target.value) || 15})}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Min Order Amount (coins)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={config.min_order_amount ?? 10}
                        onChange={(e) => setConfig({...config, min_order_amount: parseFloat(e.target.value) || 10})}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Max Order Amount (coins)</Label>
                      <Input
                        type="number"
                        step="100"
                        min="100"
                        value={config.max_order_amount ?? 1000000}
                        onChange={(e) => setConfig({...config, max_order_amount: parseFloat(e.target.value) || 1000000})}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Price Fluctuation Range (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="50"
                        value={config.price_fluctuation_range ?? 5}
                        onChange={(e) => setConfig({...config, price_fluctuation_range: parseFloat(e.target.value) || 5})}
                      />
                      <p className="text-xs text-muted-foreground">
                        Maximum % change per update
                      </p>
                    </div>

                    <div className="flex items-center gap-2 md:col-span-2">
                      <input
                        type="checkbox"
                        checked={config.auto_price_fluctuation !== false}
                        onChange={(e) => setConfig({...config, auto_price_fluctuation: e.target.checked})}
                        className="w-4 h-4"
                      />
                      <Label>Enable Automatic Price Fluctuation</Label>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button onClick={fetchData} variant="outline" disabled={saving}>
                    Reset
                  </Button>
                  <Button onClick={saveConfig} disabled={saving}>
                    {saving ? 'Saving...' : '💾 Save Configuration'}
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Stock Modal */}
        {editingStock && (
          <Card className="p-6 border-2 border-primary/50">
            <h2 className="text-xl font-bold mb-4">✏️ Edit Stock: {editingStock.symbol}</h2>
            
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={editingStock.name}
                    onChange={(e) => setEditingStock({...editingStock, name: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={editingStock.description || ''}
                    onChange={(e) => setEditingStock({...editingStock, description: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Emoji</Label>
                  <Input
                    value={editingStock.emoji || ''}
                    onChange={(e) => setEditingStock({...editingStock, emoji: e.target.value})}
                    maxLength={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Current Price (coins)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={editingStock.current_price}
                    onChange={(e) => setEditingStock({...editingStock, current_price: parseFloat(e.target.value) || 0})}
                  />
                  <p className="text-xs text-muted-foreground">
                    Manually set stock price (admin override)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Volatility (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="100"
                    value={editingStock.volatility}
                    onChange={(e) => setEditingStock({...editingStock, volatility: parseFloat(e.target.value) || 5})}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <select
                    value={editingStock.status}
                    onChange={(e) => setEditingStock({...editingStock, status: e.target.value})}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="delisted">Delisted</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button onClick={() => setEditingStock(null)} variant="outline">
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    const { id, ...updates } = editingStock;
                    updateStock(id, updates);
                  }}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : '💾 Save Changes'}
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
