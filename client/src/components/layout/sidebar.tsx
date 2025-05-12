import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard,
  Clock,
  Users,
  FileBarChart,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  HelpCircle,
} from "lucide-react";

export default function Sidebar() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const navItems = [
    {
      name: "Dashboard",
      href: "/",
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    {
      name: "Timesheet Entry",
      href: "/timesheet",
      icon: <Clock className="h-5 w-5" />,
    },
    {
      name: "Employees",
      href: "/employees",
      icon: <Users className="h-5 w-5" />,
    },
    {
      name: "Reports",
      href: "/reports",
      icon: <FileBarChart className="h-5 w-5" />,
    },
    {
      name: "Settings",
      href: "/settings",
      icon: <Settings className="h-5 w-5" />,
    },
  ];

  const getInitials = (username: string) => {
    return username.substring(0, 2).toUpperCase();
  };

  const toggleMobileMenu = () => {
    setMobileOpen(!mobileOpen);
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-64 bg-white border-r border-neutral-200 h-screen">
        <div className="flex items-center justify-center h-16 border-b border-neutral-200">
          <h1 className="text-xl font-semibold text-primary">Timesheet Manager</h1>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-2">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>
                  <div
                    className={`flex items-center px-4 py-3 text-sm font-medium rounded-md ${
                      location === item.href
                        ? "text-white bg-primary"
                        : "text-neutral-700 hover:bg-neutral-100"
                    }`}
                  >
                    {item.icon}
                    <span className="ml-3">{item.name}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-neutral-200">
          <div className="flex items-center">
            <Avatar>
              <AvatarFallback>{user ? getInitials(user.username) : ""}</AvatarFallback>
            </Avatar>
            <div className="ml-3">
              <p className="text-sm font-medium text-neutral-800">{user?.username}</p>
              <p className="text-xs text-neutral-500 capitalize">{user?.role}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto text-neutral-500 hover:text-neutral-700"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="bg-white border-b border-neutral-200 md:hidden">
        <div className="flex items-center justify-between h-16 px-6">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-primary">Timesheet Manager</h1>
          </div>

          <div className="flex items-center">
            <Button variant="ghost" size="icon" className="text-neutral-500">
              <Bell className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-neutral-500">
              <HelpCircle className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Sidebar Toggle */}
      <div className="md:hidden fixed bottom-6 right-6 z-50">
        <Button
          onClick={toggleMobileMenu}
          className="bg-primary text-white p-3 rounded-full shadow-lg"
        >
          <Menu className="h-6 w-6" />
        </Button>
      </div>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black bg-opacity-50">
          <div className="bg-white h-full w-4/5 max-w-xs flex flex-col">
            <div className="flex items-center justify-between h-16 px-4 border-b border-neutral-200">
              <h1 className="text-xl font-semibold text-primary">Timesheet Manager</h1>
              <Button variant="ghost" size="icon" onClick={toggleMobileMenu}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <nav className="flex-1 overflow-y-auto py-4">
              <ul className="space-y-1 px-2">
                {navItems.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href}>
                      <div
                        className={`flex items-center px-4 py-3 text-sm font-medium rounded-md ${
                          location === item.href
                            ? "text-white bg-primary"
                            : "text-neutral-700 hover:bg-neutral-100"
                        }`}
                        onClick={toggleMobileMenu}
                      >
                        {item.icon}
                        <span className="ml-3">{item.name}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="p-4 border-t border-neutral-200">
              <div className="flex items-center">
                <Avatar>
                  <AvatarFallback>{user ? getInitials(user.username) : ""}</AvatarFallback>
                </Avatar>
                <div className="ml-3">
                  <p className="text-sm font-medium text-neutral-800">{user?.username}</p>
                  <p className="text-xs text-neutral-500 capitalize">{user?.role}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto text-neutral-500 hover:text-neutral-700"
                  onClick={handleLogout}
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}