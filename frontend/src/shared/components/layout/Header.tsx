import { useAuth } from '@/features/auth/hooks/useAuth';
import { LanguageSwitcher } from '@/shared/components/ui/LanguageSwitcher';
import { useI18n } from '@/shared/i18n';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuth();
  const { t } = useI18n();

  return (
    <header className="h-12 bg-bg-panel border-b border-border-subtle flex items-center px-4 md:px-6">
      {/* Mobile hamburger — left */}
      <button onClick={onMenuClick} className="md:hidden text-text-secondary hover:text-text-primary text-lg mr-auto">
        ☰
      </button>

      {/* Spacer pushes right content to end */}
      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-3 shrink-0">
        <LanguageSwitcher />
        <span className="text-[13px] font-medium text-text-secondary hidden sm:inline">
          {user?.fullName || user?.full_name}
        </span>
        <button
          onClick={logout}
          className="text-[12px] font-medium text-text-muted hover:text-text-primary transition-colors cursor-pointer"
        >
          {t('logout')}
        </button>
      </div>
    </header>
  );
}
