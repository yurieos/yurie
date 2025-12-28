'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { ReactNode } from 'react';

interface ClerkProviderWrapperProps {
  children: ReactNode;
}

export function ClerkProviderWrapper({ children }: ClerkProviderWrapperProps) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      appearance={{
        variables: {
          // Brand colors matching app theme
          colorPrimary: '#d97757',
          colorDanger: '#c0392b',
          colorSuccess: '#22c55e',
          colorWarning: '#f59e0b',
          
          // Dark theme backgrounds
          colorBackground: '#0a0a0a',
          colorInputBackground: '#1a1a1a',
          colorInputText: '#ffffff',
          colorText: '#ffffff',
          colorTextOnPrimaryBackground: '#ffffff',
          colorTextSecondary: '#8a8a8a',
          
          // Styling
          borderRadius: '0.75rem',
          colorNeutral: '#8a8a8a',
          spacingUnit: '0.875rem',
          fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
        },
        elements: {
          // Root & Card - matching app's card style
          rootBox: 'font-sans',
          card: 'bg-[#0a0a0a] border border-[#1a1a1a] shadow-2xl rounded-2xl',
          
          // Modal - sleek dark overlay
          modalBackdrop: 'bg-black/90 backdrop-blur-sm',
          modalContent: 'bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl shadow-2xl',
          modalCloseButton: 'text-[#8a8a8a] hover:text-white hover:bg-[#1a1a1a] rounded-lg p-2 transition-all duration-200',
          
          // Headers - clean typography
          headerTitle: 'text-white text-xl font-semibold tracking-tight',
          headerSubtitle: 'text-[#8a8a8a] text-sm',
          
          // Navbar - seamless with app sidebar style
          navbar: 'bg-[#0a0a0a] border-0 p-2',
          navbarButton: 'text-[#8a8a8a] hover:text-white hover:bg-[#1a1a1a] rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200',
          navbarButtonIcon: 'text-[#8a8a8a] w-4 h-4',
          navbarButtons: 'gap-1',
          'navbarButton__active': 'bg-[#1a1a1a] text-white',
          'navbarButtonIcon__active': 'text-[#d97757]',
          
          // Page - consistent dark background
          pageScrollBox: 'bg-[#0a0a0a] px-6 py-6',
          page: 'bg-[#0a0a0a]',
          profilePage: 'bg-[#0a0a0a]',
          
          // Sections - clean separation
          profileSection: 'border-0 pb-6 mb-4',
          profileSectionTitle: 'text-[#8a8a8a] text-xs uppercase tracking-widest font-semibold mb-4',
          profileSectionTitleText: 'text-[#8a8a8a]',
          profileSectionContent: 'space-y-2',
          profileSectionPrimaryButton: 'text-white hover:text-[#d97757] text-sm font-medium transition-colors duration-200',
          
          // Forms - matching app input style
          formButtonPrimary: 'bg-[#d97757] hover:bg-[#c96442] text-white font-semibold rounded-xl h-11 px-6 text-sm transition-all duration-200 shadow-lg shadow-[#d97757]/20 hover:shadow-[#d97757]/30',
          formButtonReset: 'text-[#8a8a8a] hover:text-white text-sm font-medium transition-colors duration-200',
          formFieldInput: 'bg-[#1a1a1a] border border-[#2a2a2a] text-white placeholder:text-[#666666] rounded-xl h-11 px-4 text-sm focus:ring-2 focus:ring-[#d97757]/50 focus:border-[#d97757] transition-all duration-200',
          formFieldLabel: 'text-[#8a8a8a] text-sm font-medium mb-2',
          formFieldAction: 'text-[#d97757] hover:text-[#e88868] text-sm font-medium transition-colors duration-200',
          formFieldInputShowPasswordButton: 'text-[#8a8a8a] hover:text-white transition-colors',
          formFieldSuccessText: 'text-[#22c55e] text-sm',
          formFieldErrorText: 'text-[#c0392b] text-sm',
          formResendCodeLink: 'text-[#d97757] hover:text-[#e88868] text-sm font-medium transition-colors',
          
          // Buttons - consistent with app buttons
          button: 'transition-all duration-200',
          buttonArrowIcon: 'text-[#8a8a8a]',
          
          // Menus - sleek dropdown style
          menuButton: 'text-[#8a8a8a] hover:text-white rounded-lg p-2 transition-all duration-200',
          menuList: 'bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl shadow-2xl py-2',
          menuItem: 'text-white hover:bg-[#1a1a1a] px-4 py-2.5 text-sm font-medium transition-all duration-200',
          
          // Social buttons - matching app style
          socialButtonsBlockButton: 'bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-[#2a2a2a] text-white rounded-xl h-11 text-sm font-medium transition-all duration-200',
          socialButtonsBlockButtonText: 'text-white text-sm font-medium',
          socialButtonsProviderIcon: 'w-5 h-5',
          
          // Dividers - subtle
          dividerLine: 'bg-[#1a1a1a]',
          dividerText: 'text-[#666666] text-xs font-medium',
          
          // User preview in profile modal
          userButtonBox: 'relative',
          
          // User preview in modals
          userPreviewMainIdentifier: 'text-white font-semibold text-base',
          userPreviewSecondaryIdentifier: 'text-[#8a8a8a] text-sm',
          userPreview: 'gap-3',
          userPreviewAvatarBox: 'w-12 h-12 ring-2 ring-[#1a1a1a]',
          userPreviewAvatarImage: 'rounded-full',
          userPreviewTextContainer: 'gap-1',
          
          // Avatar - consistent with app
          avatarBox: 'rounded-full ring-2 ring-[#1a1a1a]',
          avatarImage: 'rounded-full',
          
          // Badges - matching app style
          badge: 'bg-[#1a1a1a] text-[#8a8a8a] border border-[#2a2a2a] rounded-lg px-2.5 py-1 text-xs font-medium',
          tagInputContainer: 'bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl',
          tagPillContainer: 'bg-[#1a1a1a] text-white border border-[#2a2a2a] rounded-lg',
          
          // Alerts - matching destructive colors
          alert: 'bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4',
          alertText: 'text-white text-sm',
          
          // Identity preview
          identityPreview: 'bg-transparent p-0',
          identityPreviewText: 'text-white text-sm font-medium',
          identityPreviewEditButton: 'text-[#d97757] hover:text-[#e88868] text-sm font-medium transition-colors',
          identityPreviewEditButtonIcon: 'text-[#d97757] w-4 h-4',
          
          // Footer - hidden for cleaner look
          footer: 'hidden',
          footerAction: 'hidden',
          footerActionLink: 'hidden',
          footerActionText: 'hidden',
          footerPages: 'hidden',
          
          // Misc elements
          scrollBox: 'scrollbar-none',
          phoneInputBox: 'bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl',
          tableHead: 'text-[#8a8a8a] text-xs font-semibold uppercase tracking-wider border-0',
          breadcrumbs: 'text-[#8a8a8a]',
          breadcrumbsItem: 'text-[#8a8a8a] hover:text-white text-sm font-medium transition-colors',
          breadcrumbsItemDivider: 'text-[#2a2a2a]',
          selectButton: 'bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-xl h-11',
          selectButtonIcon: 'text-[#8a8a8a]',
          selectOptionsContainer: 'bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl shadow-2xl',
          selectOption: 'text-white hover:bg-[#1a1a1a] px-4 py-2.5 text-sm font-medium transition-colors',
          otpCodeFieldInput: 'bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-xl w-12 h-14 text-center text-xl font-semibold focus:ring-2 focus:ring-[#d97757]/50 focus:border-[#d97757] transition-all',
          accordionTriggerButton: 'text-white hover:bg-[#1a1a1a] rounded-xl p-3 transition-all duration-200',
          accordionContent: 'bg-[#1a1a1a] rounded-xl p-4 mt-2',
          
          // Active session card
          activeDeviceIcon: 'text-[#d97757]',
          activeDevice: 'bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4',
          
          // Verification
          verificationLinkStatusBox: 'bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl',
          verificationLinkStatusIconBox: 'bg-[#d97757]/20 rounded-full',
          verificationLinkStatusIcon: 'text-[#d97757]',
          verificationLinkStatusText: 'text-white',
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
