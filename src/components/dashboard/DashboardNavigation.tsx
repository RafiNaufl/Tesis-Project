import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Clock, 
  CalendarDays, 
  Banknote, 
  Wallet, 
  HandCoins, 
  User, 
  Users, 
  FileText 
} from 'lucide-react';

interface DashboardNavigationProps {
  userRole?: string;
}

export default function DashboardNavigation({ userRole }: DashboardNavigationProps) {
  const pathname = usePathname();
  const isAdmin = userRole === 'ADMIN';

  const navigation = [
    { 
      name: "Dashboard", 
      href: "/dashboard", 
      icon: LayoutDashboard,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
      hoverColor: "group-hover:text-blue-700",
      hoverBg: "group-hover:bg-blue-200"
    },
    { 
      name: "Absensi", 
      href: "/attendance", 
      icon: Clock,
      color: "text-green-600",
      bgColor: "bg-green-100",
      hoverColor: "group-hover:text-green-700",
      hoverBg: "group-hover:bg-green-200"
    },
    { 
      name: "Cuti", 
      href: "/leave", 
      icon: CalendarDays,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
      hoverColor: "group-hover:text-purple-700",
      hoverBg: "group-hover:bg-purple-200"
    },
    { 
      name: "Penggajian", 
      href: "/payroll", 
      icon: Banknote,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100",
      hoverColor: "group-hover:text-emerald-700",
      hoverBg: "group-hover:bg-emerald-200"
    },
    { 
      name: "Kasbon", 
      href: "/advance", 
      icon: Wallet,
      color: "text-amber-600",
      bgColor: "bg-amber-100",
      hoverColor: "group-hover:text-amber-700",
      hoverBg: "group-hover:bg-amber-200"
    },
    { 
      name: "Pinjaman", 
      href: "/soft-loan", 
      icon: HandCoins,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
      hoverColor: "group-hover:text-orange-700",
      hoverBg: "group-hover:bg-orange-200"
    },
    { 
      name: "Profil", 
      href: "/profile", 
      icon: User,
      color: "text-indigo-600",
      bgColor: "bg-indigo-100",
      hoverColor: "group-hover:text-indigo-700",
      hoverBg: "group-hover:bg-indigo-200"
    },
  ];

  if (isAdmin) {
    navigation.push(
      { 
        name: "Karyawan", 
        href: "/dashboard/employees", 
        icon: Users,
        color: "text-cyan-600",
        bgColor: "bg-cyan-100",
        hoverColor: "group-hover:text-cyan-700",
        hoverBg: "group-hover:bg-cyan-200"
      },
      { 
        name: "Laporan", 
        href: "/reports", 
        icon: FileText,
        color: "text-rose-600",
        bgColor: "bg-rose-100",
        hoverColor: "group-hover:text-rose-700",
        hoverBg: "group-hover:bg-rose-200"
      }
    );
  }

  return (
    <div className="w-full bg-white shadow-sm rounded-lg mb-6 overflow-hidden">
      <div className="p-4">
        <h3 className="text-sm font-medium text-gray-500 mb-3 px-1">Menu Navigasi</h3>
        <div className="grid grid-cols-4 sm:flex sm:flex-wrap gap-2 sm:gap-4 justify-items-center sm:justify-items-start">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`
                  group flex flex-col items-center justify-center w-full sm:w-auto sm:min-w-[90px] p-2 sm:p-3 rounded-xl transition-all duration-200
                  hover:scale-105 active:scale-95
                  ${isActive 
                    ? 'bg-gray-50 ring-2 ring-gray-100' 
                    : 'hover:bg-gray-50'
                  }
                `}
              >
                <div className={`
                  p-2.5 rounded-xl mb-2 transition-colors shadow-sm
                  ${isActive ? `${item.bgColor} ${item.color}` : `${item.bgColor} ${item.color} bg-opacity-60`}
                  ${item.hoverBg}
                `}>
                  <Icon className={`w-6 h-6 sm:w-7 sm:h-7 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                </div>
                <span className={`
                  text-[10px] sm:text-xs font-medium text-center whitespace-nowrap
                  ${isActive ? 'text-gray-900 font-semibold' : 'text-gray-600 group-hover:text-gray-900'}
                `}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
