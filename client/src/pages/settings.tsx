import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  SettingsIcon,
  Users,
  DollarSign,
  Route,
  Lock,
  AlertCircle,
  Loader2,
  RefreshCw,
  ClipboardList,
} from "lucide-react";

type Settings = {
  mileage_rate: string;
  ot_threshold: string;
};

type AuditLog = {
  id: number;
  table_name: string;
  row_id: number;
  changed_by_user: {
    id: number;
    username: string;
  } | null;
  field: string;
  old_val: string | null;
  new_val: string | null;
  changed_at: string;
};

export default function Settings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [mileageRate, setMileageRate] = useState("");
  const [otThreshold, setOtThreshold] = useState("");
  const [activeTab, setActiveTab] = useState("general");

  // Fetch settings
  const {
    data: settings,
    isLoading: isSettingsLoading,
    isError: isSettingsError,
  } = useQuery<Settings>({
    queryKey: ["/api/settings"],
    enabled: user?.role === "admin",
    onSuccess: (data) => {
      setMileageRate(data.mileage_rate);
      setOtThreshold(data.ot_threshold);
    },
  });

  // Fetch audit logs
  const {
    data: auditLogs = [],
    isLoading: isAuditLogsLoading,
    isError: isAuditLogsError,
  } = useQuery<AuditLog[]>({
    queryKey: ["/api/audit-logs"],
    enabled: user?.role === "admin" && activeTab === "audit",
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<Settings>) => {
      const res = await apiRequest("PUT", "/api/settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Success",
        description: "Settings updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update settings: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Handle save settings
  const handleSaveSettings = () => {
    if (!mileageRate || !otThreshold) {
      toast({
        title: "Error",
        description: "Please fill out all fields",
        variant: "destructive",
      });
      return;
    }

    const mileageRateNum = parseFloat(mileageRate);
    const otThresholdNum = parseFloat(otThreshold);

    if (isNaN(mileageRateNum) || isNaN(otThresholdNum)) {
      toast({
        title: "Error",
        description: "Please enter valid numbers",
        variant: "destructive",
      });
      return;
    }

    updateSettingsMutation.mutate({
      mileage_rate: mileageRate,
      ot_threshold: otThreshold,
    });
  };

  // Format date for display
  const formatDateTime = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Check if user has admin access
  const isAdmin = user?.role === "admin";

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-neutral-900">Settings</h2>
            <p className="text-neutral-500">Configure system settings and view audit logs</p>
          </div>

          {!isAdmin ? (
            <Alert className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Access Restricted</AlertTitle>
              <AlertDescription>
                You need administrator privileges to access settings.
                Please contact your system administrator for assistance.
              </AlertDescription>
            </Alert>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-6">
                <TabsTrigger value="general">
                  <SettingsIcon className="mr-2 h-4 w-4" />
                  General Settings
                </TabsTrigger>
                <TabsTrigger value="audit">
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Audit Logs
                </TabsTrigger>
              </TabsList>
              
              {/* General Settings Tab */}
              <TabsContent value="general">
                {isSettingsLoading ? (
                  <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : isSettingsError ? (
                  <Alert variant="destructive" className="mb-6">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>
                      Could not load settings. Please try again later.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="grid gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Payroll Settings</CardTitle>
                        <CardDescription>
                          Configure how pay rates and calculations work
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="space-y-2">
                          <Label htmlFor="mileage-rate">Mileage Rate ($ per mile)</Label>
                          <div className="flex items-center">
                            <DollarSign className="mr-2 h-4 w-4 text-neutral-500" />
                            <Input
                              id="mileage-rate"
                              type="number"
                              step="0.01"
                              min="0"
                              value={mileageRate}
                              onChange={(e) => setMileageRate(e.target.value)}
                              className="max-w-[200px]"
                            />
                          </div>
                          <p className="text-sm text-neutral-500">
                            Current rate: ${settings?.mileage_rate} per mile
                          </p>
                        </div>
                        
                        <Separator />
                        
                        <div className="space-y-2">
                          <Label htmlFor="ot-threshold">Overtime Threshold (hours per week)</Label>
                          <div className="flex items-center">
                            <Clock className="mr-2 h-4 w-4 text-neutral-500" />
                            <Input
                              id="ot-threshold"
                              type="number"
                              step="0.5"
                              min="0"
                              value={otThreshold}
                              onChange={(e) => setOtThreshold(e.target.value)}
                              className="max-w-[200px]"
                            />
                          </div>
                          <p className="text-sm text-neutral-500">
                            Hours beyond this threshold will be paid at overtime rate (1.5x)
                          </p>
                        </div>
                      </CardContent>
                      <CardFooter>
                        <Button 
                          onClick={handleSaveSettings}
                          disabled={updateSettingsMutation.isPending}
                        >
                          {updateSettingsMutation.isPending && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Save Settings
                        </Button>
                      </CardFooter>
                    </Card>
                    
                    <Card>
                      <CardHeader>
                        <CardTitle>System Information</CardTitle>
                        <CardDescription>
                          Details about the current system
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex justify-between border-b pb-2">
                            <span className="text-neutral-500">Current User</span>
                            <span className="font-medium">{user?.username} ({user?.role})</span>
                          </div>
                          <div className="flex justify-between border-b pb-2">
                            <span className="text-neutral-500">Version</span>
                            <span className="font-medium">1.0.0</span>
                          </div>
                          <div className="flex justify-between border-b pb-2">
                            <span className="text-neutral-500">Environment</span>
                            <span className="font-medium">
                              {process.env.NODE_ENV === 'production' ? 'Production' : 'Development'}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </TabsContent>
              
              {/* Audit Logs Tab */}
              <TabsContent value="audit">
                {isAuditLogsLoading ? (
                  <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : isAuditLogsError ? (
                  <Alert variant="destructive" className="mb-6">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>
                      Could not load audit logs. Please try again later.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <div>
                        <CardTitle>Audit Logs</CardTitle>
                        <CardDescription>
                          Track all changes made in the system
                        </CardDescription>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/audit-logs"] })}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {auditLogs.length === 0 ? (
                        <div className="text-center py-12 border rounded-md bg-neutral-50">
                          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
                            <ClipboardList className="h-6 w-6 text-neutral-500" />
                          </div>
                          <h3 className="mt-4 text-lg font-medium text-neutral-900">No audit logs found</h3>
                          <p className="mt-2 text-sm text-neutral-500">
                            System activity will be recorded here
                          </p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Time</TableHead>
                                <TableHead>User</TableHead>
                                <TableHead>Table</TableHead>
                                <TableHead>Row ID</TableHead>
                                <TableHead>Field</TableHead>
                                <TableHead>Old Value</TableHead>
                                <TableHead>New Value</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {auditLogs.map((log) => (
                                <TableRow key={log.id}>
                                  <TableCell className="text-sm">
                                    {formatDateTime(log.changed_at)}
                                  </TableCell>
                                  <TableCell>
                                    {log.changed_by_user?.username || 'System'}
                                  </TableCell>
                                  <TableCell>
                                    {log.table_name}
                                  </TableCell>
                                  <TableCell>
                                    {log.row_id}
                                  </TableCell>
                                  <TableCell>
                                    {log.field}
                                  </TableCell>
                                  <TableCell className="max-w-[200px] truncate">
                                    {log.old_val || '—'}
                                  </TableCell>
                                  <TableCell className="max-w-[200px] truncate">
                                    {log.new_val || '—'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          )}
        </main>
      </div>
    </div>
  );
}

function Clock(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
