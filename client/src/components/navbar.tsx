import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  UserPlus,
  Receipt,
  Pill,
  Stethoscope,
  Wallet,
  BarChart3,
  Moon,
  Sun,
  Calendar,
  Database,
  ChevronDown,
  LogOut,
  Users,
  CheckSquare,
  ShieldAlert,
  Plus,
  MessageCircle,
  Zap,
  History,
  Settings2,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";

interface NavItem {
  path?: string;
  label: string;
  icon: any;
  module?: string;
  children?: { path: string; label: string; icon: any; module?: string }[];
}

const navItems: NavItem[] = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  {
    label: "Patients Desk",
    icon: UserPlus,
    children: [
      { path: "/registration", label: "New Registration", icon: UserPlus, module: "patients" },
      { path: "/patients", label: "View Patients", icon: Users, module: "patients" },
      { path: "/appointments", label: "Appointments", icon: Calendar, module: "appointments" },
    ]
  },
  {
    label: "Billing & Finance",
    icon: Receipt,
    children: [
      { path: "/billing", label: "Create Bill", icon: Plus, module: "billing" },
      { path: "/bills", label: "View Bills", icon: Receipt, module: "billing" },
      { path: "/expenses", label: "Expenses", icon: Wallet, module: "expenses" },
    ]
  },
  {
    label: "Masters",
    icon: Database,
    children: [
      { path: "/medicines", label: "Medicine Master", icon: Pill, module: "medicines" },
      { path: "/treatments", label: "Treatment Master", icon: Stethoscope, module: "treatments" },
      { path: "/departments", label: "Department Master", icon: Database, module: "treatments" },
    ]
  },
  {
    label: "CRM",
    icon: Users,
    children: [
      { path: "/crm", label: "CRM Dashboard", icon: LayoutDashboard, module: "crm" },
      { path: "/crm/leads", label: "Leads Manager", icon: Users, module: "crm" },
      { path: "/crm/tasks", label: "CRM Tasks", icon: CheckSquare, module: "crm" },
    ]
  },
  {
    label: "WhatsApp Automation",
    icon: MessageCircle,
    children: [
      { path: "/crm/whatsapp", label: "Automation Dashboard", icon: LayoutDashboard, module: "whatsappAutomation" },
      { path: "/crm/whatsapp/rules", label: "Automation Rules", icon: Zap, module: "whatsappAutomation" },
      { path: "/crm/whatsapp/templates", label: "Templates", icon: FileText, module: "whatsappAutomation" },
      { path: "/crm/whatsapp/history", label: "Execution History", icon: History, module: "whatsappAutomation" },
      { path: "/crm/whatsapp/settings", label: "WhatsApp Settings", icon: Settings2, module: "whatsappAutomation" },
    ]
  },
  { path: "/reports", label: "Reports", icon: BarChart3, module: "reports" },
];

function NavDropdown({ item, isActive }: { item: any, isActive: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = item.icon;

  return (
    <div
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      className="relative"
    >
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant={isActive ? "default" : "ghost"}
            size="sm"
            className="gap-2 shrink-0 transition-all duration-200"
            data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden lg:inline-block">{item.label}</span>
            <ChevronDown className="w-3 h-3 ml-0.5 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52 backdrop-blur-md bg-card/95 shadow-lg border animate-in fade-in slide-in-from-top-1">
          {item.children.map((child: any) => {
            const ChildIcon = child.icon;
            return (
              <Link key={child.path} href={child.path}>
                <DropdownMenuItem className="cursor-pointer gap-2 py-2.5 transition-colors hover:bg-muted/80">
                  <ChildIcon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{child.label}</span>
                </DropdownMenuItem>
              </Link>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function Navbar() {
  const [location, setLocation] = useLocation();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const { user, logoutMutation } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);

  if (!user) return null;

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        setLocation("/auth");
      }
    });
  };

  const checkPermission = (moduleName?: string) => {
    if (user.role === "SuperAdmin") return true;
    if (!moduleName) return true;
    return !!user.permissions?.[moduleName]?.view;
  };

  const filteredNavItems = navItems
    .map(item => {
      if (item.children) {
        const filteredChildren = item.children.filter(child => checkPermission(child.module));
        if (filteredChildren.length === 0) return null;
        return { ...item, children: filteredChildren };
      }
      if (!checkPermission(item.module)) return null;
      return item;
    })
    .filter((item): item is NavItem => item !== null);

  if (user.role === "SuperAdmin") {
    filteredNavItems.push({
      path: "/users",
      label: "Users",
      icon: ShieldAlert
    });
  }

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-sm">
      <div className="max-w-[1600px] mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 shrink-0 hover:opacity-90 transition-opacity">
            <img src="/logo.png" alt="Nobel Essence Logo" className="w-9 h-9 object-contain" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight leading-none text-foreground" data-testid="text-clinic-name">
                Nobel Mulani
              </span>
              <span className="text-[9px] text-muted-foreground font-medium hidden md:inline-block mt-0.5">
                Hair Transplant * Cosmetic-Aesthetic center
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {filteredNavItems.map((item, index) => {
              if (item.children) {
                const isActive = item.children.some(child => child.path === location);
                return <NavDropdown key={index} item={item} isActive={isActive} />;
              }

              const isActive = location === item.path;
              const Icon = item.icon;
              return (
                <Link key={item.path} href={item.path!}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    className="gap-2 shrink-0 transition-all duration-200"
                    data-testid={`nav-${item.path!.replace("/", "") || "dashboard"}`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden lg:inline-block">{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {/* User Profile dropdown opens on Hover */}
            <div
              onMouseEnter={() => setProfileOpen(true)}
              onMouseLeave={() => setProfileOpen(false)}
              className="relative"
            >
              <DropdownMenu open={profileOpen} onOpenChange={setProfileOpen} modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-9 gap-2 px-3 hover:bg-muted/80 rounded-md">
                    <div className="flex flex-col items-end text-right hidden sm:flex">
                      <span className="text-xs font-semibold text-foreground leading-none">{user.username}</span>
                      <span className="text-[10px] text-muted-foreground mt-1 capitalize">{user.role}</span>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 backdrop-blur-md bg-card/95 shadow-md border animate-in fade-in slide-in-from-top-1">
                  {user.role === "SuperAdmin" && (
                    <Link href="/users">
                      <DropdownMenuItem className="cursor-pointer gap-2 py-2.5 transition-colors hover:bg-muted/80">
                        <ShieldAlert className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">User Management</span>
                      </DropdownMenuItem>
                    </Link>
                  )}
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer gap-2 py-2.5 text-destructive hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm font-medium">Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              data-testid="button-theme-toggle"
            >
              {theme === "dark" ? (
                <Sun className="w-5 h-5 text-yellow-500" />
              ) : (
                <Moon className="w-5 h-5 text-indigo-500" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
