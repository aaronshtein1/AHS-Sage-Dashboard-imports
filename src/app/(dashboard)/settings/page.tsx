"use client";

import { useState, useEffect } from "react";
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
  Building2,
  Save,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("connection");
  const [showPassword, setShowPassword] = useState(false);
  const [showSenderPassword, setShowSenderPassword] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "error">("disconnected");
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch("/api/settings");
      const data = await response.json();

      if (data.success && data.settings) {
        setCredentials({
          companyId: data.settings.companyId || "",
          userId: data.settings.userId || "",
          userPassword: data.settings.userPassword || "",
          senderId: data.settings.senderId || "",
          senderPassword: data.settings.senderPassword || "",
        });
        setSettings({
          fiscalYearStartMonth: data.settings.fiscalYearStartMonth || "1",
          defaultLocation: data.settings.defaultLocation || "",
          autoSyncEnabled: data.settings.autoSyncEnabled ?? true,
          syncInterval: data.settings.syncInterval || "hourly",
        });

        if (data.settings.hasCredentials) {
          setConnectionStatus("connected");
        }
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setIsConnecting(true);
    setSaveMessage(null);

    try {
      const response = await fetch("/api/intacct/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (data.success) {
        setConnectionStatus("connected");
        setSaveMessage({ type: "success", text: "Connection successful!" });
      } else {
        setConnectionStatus("error");
        setSaveMessage({ type: "error", text: data.error || "Connection failed" });
      }
    } catch (error) {
      setConnectionStatus("error");
      setSaveMessage({ type: "error", text: "Failed to test connection" });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSaveCredentials = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...credentials,
          ...settings,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSaveMessage({ type: "success", text: "Credentials saved successfully!" });
        // Reload to get masked passwords
        await loadSettings();
      } else {
        setSaveMessage({ type: "error", text: data.error || "Failed to save credentials" });
      }
    } catch (error) {
      setSaveMessage({ type: "error", text: "Failed to save credentials" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePreferences = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const data = await response.json();

      if (data.success) {
        setSaveMessage({ type: "success", text: "Preferences saved successfully!" });
      } else {
        setSaveMessage({ type: "error", text: data.error || "Failed to save preferences" });
      }
    } catch (error) {
      setSaveMessage({ type: "error", text: "Failed to save preferences" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col">
        <Header
          title="Settings"
          subtitle="Configure your Sage Intacct connection and application settings"
        />
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <Header
        title="Settings"
        subtitle="Configure your Sage Intacct connection and application settings"
      />

      <div className="p-6">
        {/* Save Message */}
        {saveMessage && (
          <div
            className={cn(
              "mb-6 flex items-center gap-2 rounded-lg p-4",
              saveMessage.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
            )}
          >
            {saveMessage.type === "success" ? (
              <Check className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
            {saveMessage.text}
          </div>
        )}

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
                      className={cn(
                        connectionStatus === "connected"
                          ? "bg-emerald-100 text-emerald-700"
                          : connectionStatus === "error"
                          ? "bg-red-100 text-red-700"
                          : "bg-zinc-100 text-zinc-700"
                      )}
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
                          Credentials saved and verified
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-zinc-500">Company ID:</span>
                          <span className="ml-2 font-medium">{credentials.companyId || "Not set"}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500">User:</span>
                          <span className="ml-2 font-medium">{credentials.userId || "Not set"}</span>
                        </div>
                      </div>
                      <Button variant="outline" className="w-full" onClick={() => setConnectionStatus("disconnected")}>
                        Edit Credentials
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded-lg bg-zinc-50 p-4">
                        <div className="flex items-center gap-2 text-zinc-600">
                          <Database className="h-5 w-5" />
                          <span>Enter your Sage Intacct credentials</span>
                        </div>
                        <p className="mt-2 text-sm text-zinc-500">
                          Your credentials will be encrypted and stored securely
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
                    <label className="mb-1 block text-sm font-medium">Company ID *</label>
                    <Input
                      placeholder="Your Intacct Company ID"
                      value={credentials.companyId}
                      onChange={(e) =>
                        setCredentials({ ...credentials, companyId: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">User ID *</label>
                    <Input
                      placeholder="Web Services User ID"
                      value={credentials.userId}
                      onChange={(e) =>
                        setCredentials({ ...credentials, userId: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">User Password *</label>
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
                    <label className="mb-1 block text-sm font-medium">Sender ID *</label>
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
                    <label className="mb-1 block text-sm font-medium">Sender Password *</label>
                    <div className="relative">
                      <Input
                        type={showSenderPassword ? "text" : "password"}
                        placeholder="Web Services Sender Password"
                        value={credentials.senderPassword}
                        onChange={(e) =>
                          setCredentials({ ...credentials, senderPassword: e.target.value })
                        }
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700"
                        onClick={() => setShowSenderPassword(!showSenderPassword)}
                      >
                        {showSenderPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={handleTestConnection}
                      disabled={isConnecting || !credentials.companyId || !credentials.userId}
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        "Test Connection"
                      )}
                    </Button>
                    <Button
                      onClick={handleSaveCredentials}
                      disabled={isSaving || !credentials.companyId || !credentials.userId}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Credentials
                        </>
                      )}
                    </Button>
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

                  <Button className="w-full" disabled={connectionStatus !== "connected"}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync Now
                  </Button>
                  {connectionStatus !== "connected" && (
                    <p className="text-sm text-amber-600">Connect to Intacct first to sync data</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Sync Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { name: "GL Accounts", lastSync: connectionStatus === "connected" ? "Ready" : "Not synced", status: connectionStatus === "connected" ? "success" : "warning" },
                      { name: "Account Balances", lastSync: connectionStatus === "connected" ? "Ready" : "Not synced", status: connectionStatus === "connected" ? "success" : "warning" },
                      { name: "Reporting Periods", lastSync: connectionStatus === "connected" ? "Ready" : "Not synced", status: connectionStatus === "connected" ? "success" : "warning" },
                      { name: "Locations", lastSync: connectionStatus === "connected" ? "Ready" : "Not synced", status: connectionStatus === "connected" ? "success" : "warning" },
                      { name: "Departments", lastSync: connectionStatus === "connected" ? "Ready" : "Not synced", status: connectionStatus === "connected" ? "success" : "warning" },
                      { name: "Budgets", lastSync: connectionStatus === "connected" ? "Ready" : "Not synced", status: connectionStatus === "connected" ? "success" : "warning" },
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

                <Button onClick={handleSavePreferences} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Preferences
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
