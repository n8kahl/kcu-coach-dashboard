'use client';

import { Header } from '@/components/layout/header';
import { PageShell, PageSection, Grid } from '@/components/layout/page-shell';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Settings,
  Bot,
  Database,
  Bell,
  Palette,
  Shield,
  Link,
  Save,
  RefreshCw,
  Check,
  X,
} from 'lucide-react';

export default function SettingsPage() {
  return (
    <>
      <Header
        title="Settings"
        subtitle="Configure bot and dashboard settings"
        breadcrumbs={[{ label: 'Admin' }, { label: 'Settings' }]}
      />

      <PageShell>
        <Tabs defaultValue="bot">
          <TabsList variant="underline">
            <TabsTrigger value="bot" variant="underline">Bot Config</TabsTrigger>
            <TabsTrigger value="dashboard" variant="underline">Dashboard</TabsTrigger>
            <TabsTrigger value="notifications" variant="underline">Notifications</TabsTrigger>
            <TabsTrigger value="integrations" variant="underline">Integrations</TabsTrigger>
          </TabsList>

          <TabsContent value="bot">
            <div className="space-y-6">
              {/* AI Settings */}
              <Card>
                <CardHeader
                  title="AI Configuration"
                  subtitle="Configure Claude AI behavior"
                />
                <CardContent>
                  <div className="grid grid-cols-2 gap-6">
                    <Select
                      label="Primary Model"
                      options={[
                        { value: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
                        { value: 'claude-haiku', label: 'Claude Haiku' },
                      ]}
                    />
                    <Input
                      label="Max Tokens"
                      type="number"
                      defaultValue={1024}
                    />
                    <Input
                      label="Temperature"
                      type="number"
                      defaultValue={0.7}
                      hint="0.0 - 1.0, lower = more deterministic"
                    />
                    <Input
                      label="Similarity Threshold"
                      type="number"
                      defaultValue={0.7}
                      hint="For knowledge base matching"
                    />
                  </div>
                  <div className="mt-6">
                    <Textarea
                      label="System Prompt Additions"
                      rows={4}
                      placeholder="Add custom instructions to the system prompt..."
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Discord Settings */}
              <Card>
                <CardHeader
                  title="Discord Configuration"
                  subtitle="Bot behavior settings"
                />
                <CardContent>
                  <div className="grid grid-cols-2 gap-6">
                    <Input
                      label="Command Prefix"
                      defaultValue="!"
                    />
                    <Input
                      label="Briefing Channel ID"
                      placeholder="Discord channel ID"
                    />
                    <Select
                      label="Response Mode"
                      options={[
                        { value: 'mention', label: 'Mention Only' },
                        { value: 'all', label: 'All Messages' },
                        { value: 'prefix', label: 'Prefix Only' },
                      ]}
                    />
                    <Select
                      label="Log Level"
                      options={[
                        { value: 'debug', label: 'Debug' },
                        { value: 'info', label: 'Info' },
                        { value: 'warn', label: 'Warning' },
                        { value: 'error', label: 'Error' },
                      ]}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Save Button */}
              <div className="flex justify-end">
                <Button variant="primary" icon={<Save className="w-4 h-4" />}>
                  Save Changes
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="dashboard">
            <div className="space-y-6">
              <Card>
                <CardHeader
                  title="Theme Settings"
                  subtitle="Customize dashboard appearance"
                />
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase text-[var(--text-tertiary)] mb-2">
                        Primary Color
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          defaultValue="#f59e0b"
                          className="w-10 h-10 bg-transparent cursor-pointer"
                        />
                        <Input defaultValue="#f59e0b" className="flex-1" />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-[var(--text-tertiary)] mb-2">
                        Success Color
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          defaultValue="#22c55e"
                          className="w-10 h-10 bg-transparent cursor-pointer"
                        />
                        <Input defaultValue="#22c55e" className="flex-1" />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-[var(--text-tertiary)] mb-2">
                        Error Color
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          defaultValue="#ef4444"
                          className="w-10 h-10 bg-transparent cursor-pointer"
                        />
                        <Input defaultValue="#ef4444" className="flex-1" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader
                  title="Win Card Branding"
                  subtitle="Default branding for generated cards"
                />
                <CardContent>
                  <div className="grid grid-cols-2 gap-6">
                    <Input
                      label="Brand Name"
                      defaultValue="KCU TRADING"
                    />
                    <Input
                      label="Website URL"
                      defaultValue="kaycapitals.com"
                    />
                    <Input
                      label="Twitter Handle"
                      defaultValue="@KCUTrading"
                    />
                    <div>
                      <p className="text-xs font-semibold uppercase text-[var(--text-tertiary)] mb-2">
                        Logo Upload
                      </p>
                      <Button variant="secondary" size="sm">
                        Upload Logo
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button variant="primary" icon={<Save className="w-4 h-4" />}>
                  Save Changes
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="notifications">
            <div className="space-y-6">
              <Card>
                <CardHeader
                  title="Daily Briefings"
                  subtitle="Configure automated briefing schedule"
                />
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-[var(--bg-tertiary)]">
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">Morning Briefing</p>
                        <p className="text-xs text-[var(--text-tertiary)]">9:00 AM ET daily</p>
                      </div>
                      <Badge variant="success" dot pulse>Enabled</Badge>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-[var(--bg-tertiary)]">
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">EOD Recap</p>
                        <p className="text-xs text-[var(--text-tertiary)]">4:30 PM ET daily</p>
                      </div>
                      <Badge variant="success" dot pulse>Enabled</Badge>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-[var(--bg-tertiary)]">
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">Weekly Summary</p>
                        <p className="text-xs text-[var(--text-tertiary)]">Sunday 6:00 PM ET</p>
                      </div>
                      <Badge variant="default">Disabled</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader
                  title="Achievement Notifications"
                  subtitle="When to announce achievements"
                />
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { label: 'First Trade', enabled: true },
                      { label: 'Streak Milestones', enabled: true },
                      { label: 'Quiz Mastery', enabled: true },
                      { label: 'Leaderboard Rankings', enabled: false },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between p-3 bg-[var(--bg-tertiary)]"
                      >
                        <span className="text-sm text-[var(--text-primary)]">{item.label}</span>
                        <button
                          className={`w-10 h-6 relative ${
                            item.enabled ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-elevated)]'
                          }`}
                        >
                          <span
                            className={`absolute top-1 w-4 h-4 bg-white transition-all ${
                              item.enabled ? 'right-1' : 'left-1'
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="integrations">
            <div className="space-y-6">
              <Grid cols={2} gap="md">
                {/* Supabase */}
                <Card>
                  <CardContent>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-[#3ecf8e]/20 flex items-center justify-center">
                        <Database className="w-6 h-6 text-[#3ecf8e]" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-[var(--text-primary)]">Supabase</p>
                        <p className="text-xs text-[var(--text-tertiary)]">Database & Auth</p>
                      </div>
                      <Badge variant="success" dot>Connected</Badge>
                    </div>
                    <Button variant="secondary" size="sm" className="w-full">
                      Test Connection
                    </Button>
                  </CardContent>
                </Card>

                {/* Discord */}
                <Card>
                  <CardContent>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-[#5865F2]/20 flex items-center justify-center">
                        <Bot className="w-6 h-6 text-[#5865F2]" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-[var(--text-primary)]">Discord</p>
                        <p className="text-xs text-[var(--text-tertiary)]">Bot Integration</p>
                      </div>
                      <Badge variant="success" dot>Connected</Badge>
                    </div>
                    <Button variant="secondary" size="sm" className="w-full">
                      Reconnect
                    </Button>
                  </CardContent>
                </Card>

                {/* Massive */}
                <Card>
                  <CardContent>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-[var(--accent-primary)]/20 flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-[var(--accent-primary)]" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-[var(--text-primary)]">Massive</p>
                        <p className="text-xs text-[var(--text-tertiary)]">Market Data API</p>
                      </div>
                      <Badge variant="success" dot>Connected</Badge>
                    </div>
                    <Button variant="secondary" size="sm" className="w-full">
                      Check Status
                    </Button>
                  </CardContent>
                </Card>

                {/* OpenAI */}
                <Card>
                  <CardContent>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-white/10 flex items-center justify-center">
                        <span className="text-xl">🧠</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-[var(--text-primary)]">OpenAI</p>
                        <p className="text-xs text-[var(--text-tertiary)]">Embeddings</p>
                      </div>
                      <Badge variant="success" dot>Connected</Badge>
                    </div>
                    <Button variant="secondary" size="sm" className="w-full">
                      Test Embeddings
                    </Button>
                  </CardContent>
                </Card>
              </Grid>

              {/* API Keys */}
              <Card>
                <CardHeader
                  title="API Keys"
                  subtitle="Manage integration credentials (values hidden)"
                />
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { label: 'DISCORD_TOKEN', status: 'configured' },
                      { label: 'SUPABASE_URL', status: 'configured' },
                      { label: 'SUPABASE_SERVICE_KEY', status: 'configured' },
                      { label: 'ANTHROPIC_API_KEY', status: 'configured' },
                      { label: 'OPENAI_API_KEY', status: 'configured' },
                      { label: 'MASSIVE_API_KEY', status: 'configured' },
                    ].map((key) => (
                      <div
                        key={key.label}
                        className="flex items-center justify-between p-3 bg-[var(--bg-tertiary)]"
                      >
                        <span className="text-sm font-mono text-[var(--text-secondary)]">
                          {key.label}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-[var(--text-muted)]">••••••••</span>
                          <Check className="w-4 h-4 text-[var(--profit)]" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </PageShell>
    </>
  );
}

function TrendingUp({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}
