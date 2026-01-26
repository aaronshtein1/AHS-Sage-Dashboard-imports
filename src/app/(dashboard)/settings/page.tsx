"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Settings,
  Database,
  RefreshCw,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Plug,
  Calendar,
  Building2
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("connection");
  const [showPassword, setShowPassword] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "error">("disconnected");

  // Form state
  const [credentials, setCredentials] = useState({
    companyId: "",
    userId: "",
    userPassword: "",
    senderId: "",
    senderPassword: "",
  });

  const [settings, setSettings] = useState({
    fiscalYearStartMonth: "1",
    defaultLocation: "",
    autoSyncEnabled: true,
    syncInterval: "hourly",
  });

  const handleTestConnection = async () => {
    setIsConnecting(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setConnectionStatus("connected");
    setIsConnecting(false);
  };

  const handleSaveCredentials = async () => {
    // Save credentials API call
    console.log("Saving credentials:", credentials);
  };

  return (
    <div className="flex flex-col">
      <Header
        title="Settings"
        subtitle="Configure your Sage Intacct connection and application settings"
      />

      <div className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="connection">
              <Plug className="mr-2 h-4 w-4" />
              Intacct Connection
            </TabsTrigger>
            <TabsTrigger value="sync">
              <RefreshCw className="mr-2 h-4 w-4" />
              Data Sync
            </TabsTrigger>
            <TabsTrigger value="preferences">
              <Settings className="mr-2 h-4 w-4" />
              Preferences
            </TabsTrigger>
          </TabsList>

          <TabsContent value="connection">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Connection Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Connection Status
                    <Badge
                      variant={
                        connectionStatus === "connected"
                          ? "success"
                          : connectionStatus === "error"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {connectionStatus === "connected" && <Check className="mr-1 h-3 w-3" />}
                      {connectionStatus === "error" && <AlertCircle className="mr-1 h-3 w-3" />}
                      {connectionStatus}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Connect to your Sage Intacct instance to sync financial data
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {connectionStatus === "connected" ? (
                    <div className="space-y-3">
                      <div className="rounded-lg bg-emerald-50 p-4">
                        <div className="flex items-center gap-2 text-emerald-700">
                          <Check className="h-5 w-5" />
                          <span className="font-medium">Connected to Sage Intacct</span>
                        </div>
                        <div className="mt-2 text-sm text-emerald-600">
                          Last sync: 5 minutes ago
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-zinc-500">Company ID:</span>
                          <span className="ml-2 font-medium">{credentials.companyId || "DEMO-COMPANY"}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500">User:</span>
                          <span className="ml-2 font-medium">{credentials.userId || "admin"}</span>
                        </div>
                      </div>
                      <Button variant="outline" className="w-full" onClick={() => setConnectionStatus("disconnected")}>
                        Disconnect
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded-lg bg-zinc-50 p-4">
                        <div className="flex items-center gap-2 text-zinc-600">
                          <Database className="h-5 w-5" />
                          <span>Not connected to Sage Intacct</span>
                        </div>
                        <p className="mt-2 text-sm text-zinc-500">
                          Enter your credentials below to connect
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Credentials Form */}
              <Card>
                <CardHeader>
                  <CardTitle>Sage Intacct Credentials</CardTitle>
                  <CardDescription>
                    Enter your Web Services credentials from Sage Intacct
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Company ID</label>
                    <Input
                      placeholder="Your Intacct Company ID"
                      value={credentials.companyId}
                      onChange={(e) =>
                        setCredentials({ ...credentials, companyId: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">User ID</label>
                    <Input
                      placeholder="Web Services User ID"
                      value={credentials.userId}
                      onChange={(e) =>
                        setCredentials({ ...credentials, userId: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">User Password</label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Web Services Password"
                        value={credentials.userPassword}
                        onChange={(e) =>
                          setCredentials({ ...credentials, userPassword: e.target.value })
                        }
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <label className="mb-1 block text-sm font-medium">Sender ID</label>
                    <Input
                      placeholder="Web Services Sender ID"
                      value={credentials.senderId}
                      onChange={(e) =>
                        setCredentials({ ...credentials, senderId: e.target.value })
                      }
                    />
                    <p className="mt-1 text-xs text-zinc-500">
                      From your Intacct Web Services subscription
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Sender Password</label>
                    <Input
                      type="password"
                      placeholder="Web Services Sender Password"
                      value={credentials.senderPassword}
                      onChange={(e) =>
                        setCredentials({ ...credentials, senderPassword: e.target.value })
                      }
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={handleTestConnection}
                      disabled={isConnecting}
                    >
                      {isConnecting ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        "Test Connection"
                      )}
                    </Button>
                    <Button onClick={handleSaveCredentials}>Save Credentials</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="sync">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Data Sync Settings</CardTitle>
                  <CardDescription>
                    Configure how data is synchronized from Sage Intacct
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <div className="font-medium">Automatic Sync</div>
                      <div className="text-sm text-zinc-500">
                        Automatically sync data on a schedule
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoSyncEnabled}
                      onChange={(e) =>
                        setSettings({ ...settings, autoSyncEnabled: e.target.checked })
                      }
                      className="h-5 w-5"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Sync Interval</label>
                    <select
                      value={settings.syncInterval}
                      onChange={(e) =>
                        setSettings({ ...settings, syncInterval: e.target.value })
                      }
                      className="w-full rounded-md border border-zinc-200 p-2"
                    >
                      <option value="hourly">Hourly</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="manual">Manual Only</option>
                    </select>
                  </div>

                  <Button className="w-full">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync Now
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Sync Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { name: "GL Accounts", lastSync: "5 min ago", status: "success" },
                      { name: "Account Balances", lastSync: "5 min ago", status: "success" },
                      { name: "Reporting Periods", lastSync: "1 hour ago", status: "success" },
                      { name: "Locations", lastSync: "1 hour ago", status: "success" },
                      { name: "Departments", lastSync: "1 hour ago", status: "success" },
                      { name: "Budgets", lastSync: "1 day ago", status: "warning" },
                    ].map((item) => (
                      <div
                        key={item.name}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "h-2 w-2 rounded-full",
                              item.status === "success"
                                ? "bg-emerald-500"
                                : item.status === "warning"
                                ? "bg-amber-500"
                                : "bg-red-500"
                            )}
                          />
                          <span className="font-medium">{item.name}</span>
                        </div>
                        <span className="text-sm text-zinc-500">{item.lastSync}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="preferences">
            <Card className="max-w-2xl">
              <CardHeader>
                <CardTitle>Application Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label className="mb-1 flex items-center gap-2 text-sm font-medium">
                    <Calendar className="h-4 w-4" />
                    Fiscal Year Start Month
                  </label>
                  <select
                    value={settings.fiscalYearStartMonth}
                    onChange={(e) =>
                      setSettings({ ...settings, fiscalYearStartMonth: e.target.value })
                    }
                    className="w-full rounded-md border border-zinc-200 p-2"
                  >
                    {[
                      "January", "February", "March", "April", "May", "June",
                      "July", "August", "September", "October", "November", "December",
                    ].map((month, idx) => (
                      <option key={month} value={idx + 1}>
                        {month}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 flex items-center gap-2 text-sm font-medium">
                    <Building2 className="h-4 w-4" />
                    Default Location
                  </label>
                  <select
                    value={settings.defaultLocation}
                    onChange={(e) =>
                      setSettings({ ...settings, defaultLocation: e.target.value })
                    }
                    className="w-full rounded-md border border-zinc-200 p-2"
                  >
                    <option value="">All Locations</option>
                    <option value="loc1">Downtown Clinic</option>
                    <option value="loc2">Westside Office</option>
                    <option value="loc3">North Campus</option>
                    <option value="loc4">East Medical Center</option>
                  </select>
                </div>

                <Button>Save Preferences</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
