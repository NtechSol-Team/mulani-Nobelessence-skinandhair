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
  Heart
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/registration", label: "New Registration", icon: UserPlus },
  { path: "/billing", label: "Medicine/Billing", icon: Receipt },
  { path: "/medicines", label: "Medicine Master", icon: Pill },
  { path: "/treatments", label: "Treatment Master", icon: Stethoscope },
  { path: "/expenses", label: "Expenses", icon: Wallet },
  { path: "/reports", label: "Reports", icon: BarChart3 },
];

export function Navbar() {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="max-w-[1600px] mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary">
              <Heart className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold tracking-tight hidden sm:inline-block" data-testid="text-clinic-name">
              Prime Care
            </span>
          </Link>

          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {navItems.map((item) => {
              const isActive = location === item.path;
              const Icon = item.icon;
              
              return (
                <Link key={item.path} href={item.path}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    className="gap-2 shrink-0"
                    data-testid={`nav-${item.path.replace("/", "") || "dashboard"}`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden lg:inline-block">{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            data-testid="button-theme-toggle"
          >
            {theme === "dark" ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </Button>
        </div>
      </div>
    </nav>
  );
}
