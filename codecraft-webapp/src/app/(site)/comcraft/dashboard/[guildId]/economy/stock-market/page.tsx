'use client';

/**
 * Stock Market Management Dashboard
 * Configure stocks, market settings, and view market data
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

export default function StockMarketPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { toast } = useToast();
  
  const [stocks, setStocks] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    if (guildId) {
      fetchData();
    }
  }, [guildId]);

  const fetchData = async () => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/economy/stock-market`);
      if (response.ok) {
        const data = await response.json();
        setStocks(data.stocks || []);
        setConfig(data.config || {});
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
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
                    Manage stocks, configure market settings, and monitor trading activity.
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
          <TabsList className="w-full grid grid-cols-3 bg-muted/50 p-2 rounded-lg">
            <TabsTrigger value="stocks" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Stocks
            </TabsTrigger>
            <TabsTrigger value="create" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Create Stock
            </TabsTrigger>
            <TabsTrigger value="config" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Market Config
            </TabsTrigger>
          </TabsList>

          {/* Stocks List Tab */}
          <TabsContent value="stocks" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6">📊 All Stocks</h2>
              
              {stocks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No stocks created yet.
                  <br />
                  <span className="text-sm">Create your first stock in the "Create Stock" tab!</span>
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

