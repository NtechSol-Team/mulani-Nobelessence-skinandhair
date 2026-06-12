import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Users, UserCheck, Calendar, Gift, MessageSquare, ArrowRight, Activity, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

const getSourceColor = (index: number) => {
  const i = Math.abs(index) % 7;
  if (i === 0) return "#0ea5e9";
  if (i === 1) return "#10b981";
  if (i === 2) return "#f59e0b";
  if (i === 3) return "#ec4899";
  if (i === 4) return "#8b5cf6";
  if (i === 5) return "#ef4444";
  return "#6b7280";
};

interface CRMStats {
  totalLeads: number;
  convertedLeads: number;
  lostLeads: number;
  activeLeads: number;
  conversionRate: number;
  sourcesBreakdown: { name: string; value: number }[];
  upcomingBirthdays: { id: string; name: string; phone: string; dob: string }[];
}

export default function CRMDashboard() {
  const { data: stats, isLoading } = useQuery<CRMStats>({
    queryKey: ["/api/crm/stats"],
  });

  const sendWhatsAppBirthday = (name: string, phone: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    const message = encodeURIComponent(`Dear ${name}, Mulani Skin Clinic wishes you a very Happy Birthday! May your day be filled with joy and glow. 🎂✨`);
    const waUrl = `https://wa.me/${cleanPhone.startsWith("91") ? cleanPhone : "91" + cleanPhone}?text=${message}`;
    window.open(waUrl, "_blank");
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-[350px] w-full" />
          <Skeleton className="h-[350px] w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">CRM Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Monitor marketing funnels, customer acquisition, and patient follow-ups
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/crm/leads">
            <Button className="gap-2">
              <Users className="w-4 h-4" />
              Manage Leads
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover-elevate transition-all">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Total Inquiries</p>
              <h3 className="text-3xl font-bold">{stats?.totalLeads || 0}</h3>
            </div>
            <div className="w-12 h-12 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-500">
              <Users className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate transition-all">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Converted Leads</p>
              <h3 className="text-3xl font-bold">{stats?.convertedLeads || 0}</h3>
            </div>
            <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500">
              <UserCheck className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate transition-all">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Active Prospects</p>
              <h3 className="text-3xl font-bold">{stats?.activeLeads || 0}</h3>
            </div>
            <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Activity className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate transition-all">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Conversion Rate</p>
              <h3 className="text-3xl font-bold">{stats?.conversionRate?.toFixed(1) || "0.0"}%</h3>
            </div>
            <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500">
              <TrendingUp className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Source Analysis Chart */}
        <Card className="flex flex-col h-[400px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Lead Acquisition Channels</CardTitle>
            <CardDescription>Breakdown of patient registration sources</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 min-h-0">
            {stats?.sourcesBreakdown && stats.sourcesBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.sourcesBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {stats.sourcesBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getSourceColor(index)} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} Patients`, 'Total']} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <Users className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm">No source details available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Birthday Wish Reminders */}
        <Card className="flex flex-col h-[400px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Upcoming Birthdays</CardTitle>
            <CardDescription>Patient birthdays in the next 7 days</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto min-h-0">
            {!stats?.upcomingBirthdays || stats.upcomingBirthdays.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <Gift className="w-10 h-10 mb-2 text-pink-500/50" />
                <p className="text-sm">No upcoming patient birthdays found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.upcomingBirthdays.map((patient) => {
                  const parts = patient.dob.split("-");
                  const formattedDob = parts.length === 3 ? `${parts[2]}/${parts[1]}` : patient.dob;
                  return (
                    <div
                      key={patient.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover-elevate transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-pink-500/10 flex items-center justify-center text-pink-500">
                          <Gift className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{patient.name}</p>
                          <p className="text-xs text-muted-foreground">Birthday: {formattedDob} | {patient.phone}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs text-pink-600 hover:text-pink-700 border-pink-200 hover:bg-pink-50"
                        onClick={() => sendWhatsAppBirthday(patient.name, patient.phone)}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Send Wish
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
