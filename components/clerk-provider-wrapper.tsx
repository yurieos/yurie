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
          colorPrimary: '#c0a080',
          colorDanger: '#b54a35',
          colorSuccess: '#6b8f71',
          colorWarning: '#d4a574',
          colorBackground: '#2d2621',
          colorInputBackground: '#3a322c',
          colorInputText: '#ece5d8',
          colorText: '#ece5d8',
          colorTextOnPrimaryBackground: '#2d2621',
          colorTextSecondary: '#a89f91',
          borderRadius: '0.5rem',
          colorNeutral: '#a89f91',
          spacingUnit: '1rem',
          fontFamily: 'inherit',
        },
        elements: {
          // Root & Card
          rootBox: 'font-sans',
          card: 'bg-[#2d2621] border-0 shadow-none',
          
          // Modal
          modalBackdrop: 'bg-black/80',
          modalContent: 'bg-[#2d2621] border border-[#3a322c] rounded-xl',
          modalCloseButton: 'text-[#7d6b56] hover:text-[#ece5d8] rounded-md p-1 transition-colors',
          
          // Headers
          headerTitle: 'text-[#ece5d8] text-lg font-medium',
          headerSubtitle: 'text-[#a89f91] text-sm',
          
          // Navbar - clean
          navbar: 'bg-[#2d2621] border-0',
          navbarButton: 'text-[#a89f91] hover:text-[#ece5d8] hover:bg-[#3a322c] rounded-md mx-1 px-3 py-2 text-sm transition-colors',
          navbarButtonIcon: 'text-[#7d6b56] w-4 h-4',
          navbarButtons: 'gap-0.5',
          'navbarButton__active': 'bg-[#3a322c] text-[#ece5d8]',
          'navbarButtonIcon__active': 'text-[#c0a080]',
          
          // Page
          pageScrollBox: 'bg-[#2d2621] px-6 py-5',
          page: 'bg-[#2d2621]',
          profilePage: 'bg-[#2d2621]',
          
          // Sections - NO dividers
          profileSection: 'border-0 pb-4 mb-2',
          profileSectionTitle: 'text-[#7d6b56] text-xs uppercase tracking-wider font-medium mb-3',
          profileSectionTitleText: 'text-[#7d6b56]',
          profileSectionContent: 'space-y-1',
          profileSectionPrimaryButton: 'text-[#c0a080] hover:text-[#d4c8b0] text-sm transition-colors',
          
          // Forms
          formButtonPrimary: 'bg-[#c0a080] hover:bg-[#b39470] text-[#2d2621] font-medium rounded-md h-9 px-4 text-sm transition-colors',
          formButtonReset: 'text-[#a89f91] hover:text-[#ece5d8] text-sm transition-colors',
          formFieldInput: 'bg-[#3a322c] border-0 text-[#ece5d8] placeholder:text-[#7d6b56] rounded-md h-10 px-3 text-sm focus:ring-1 focus:ring-[#c0a080]',
          formFieldLabel: 'text-[#a89f91] text-sm mb-1',
          formFieldAction: 'text-[#c0a080] hover:text-[#d4c8b0] text-sm transition-colors',
          formFieldInputShowPasswordButton: 'text-[#7d6b56] hover:text-[#a89f91]',
          formFieldSuccessText: 'text-[#6b8f71] text-sm',
          formFieldErrorText: 'text-[#b54a35] text-sm',
          formResendCodeLink: 'text-[#c0a080] hover:text-[#d4c8b0] text-sm',
          
          // Buttons
          button: 'transition-colors',
          buttonArrowIcon: 'text-[#7d6b56]',
          
          // Menus
          menuButton: 'text-[#7d6b56] hover:text-[#a89f91] rounded-md p-1 transition-colors',
          menuList: 'bg-[#3a322c] border border-[#4a4039] rounded-lg shadow-lg py-1',
          menuItem: 'text-[#ece5d8] hover:bg-[#4a4039] px-3 py-2 text-sm transition-colors',
          
          // Social
          socialButtonsBlockButton: 'bg-[#3a322c] hover:bg-[#4a4039] border-0 text-[#ece5d8] rounded-md h-10 transition-colors',
          socialButtonsBlockButtonText: 'text-[#ece5d8] text-sm',
          socialButtonsProviderIcon: 'w-4 h-4',
          
          // Dividers - subtle
          dividerLine: 'bg-[#3a322c]',
          dividerText: 'text-[#7d6b56] text-xs',
          
          // User popover
          userButtonPopoverCard: 'bg-[#2d2621] border border-[#3a322c] shadow-lg rounded-lg',
          userButtonPopoverMain: 'bg-[#2d2621] p-3',
          userButtonPopoverActions: 'border-t border-[#3a322c] p-1',
          userButtonPopoverActionButton: 'text-[#ece5d8] hover:bg-[#3a322c] rounded-md transition-colors',
          userButtonPopoverActionButtonText: 'text-[#ece5d8] text-sm',
          userButtonPopoverActionButtonIcon: 'text-[#7d6b56] w-4 h-4',
          userButtonPopoverFooter: 'hidden',
          userPreviewMainIdentifier: 'text-[#ece5d8] font-medium text-sm',
          userPreviewSecondaryIdentifier: 'text-[#7d6b56] text-xs',
          
          // Avatar
          avatarBox: 'rounded-full',
          avatarImage: 'rounded-full',
          
          // Badges
          badge: 'bg-[#3a322c] text-[#a89f91] border-0 rounded px-2 py-0.5 text-xs',
          tagInputContainer: 'bg-[#3a322c] border-0 rounded-md',
          tagPillContainer: 'bg-[#3a322c] text-[#a89f91] rounded',
          
          // Alerts
          alert: 'bg-[#3a322c] border-0 rounded-md p-3',
          alertText: 'text-[#ece5d8] text-sm',
          
          // Identity
          identityPreview: 'bg-transparent p-0',
          identityPreviewText: 'text-[#ece5d8] text-sm',
          identityPreviewEditButton: 'text-[#c0a080] hover:text-[#d4c8b0] text-sm transition-colors',
          identityPreviewEditButtonIcon: 'text-[#c0a080] w-3.5 h-3.5',
          
          // Footer
          footer: 'border-0 bg-[#2d2621] py-3',
          footerAction: 'text-[#7d6b56]',
          footerActionLink: 'text-[#c0a080] hover:text-[#d4c8b0] text-sm transition-colors',
          footerActionText: 'text-[#7d6b56] text-sm',
          footerPages: 'hidden',
          
          // Misc
          scrollBox: 'scrollbar-none',
          phoneInputBox: 'bg-[#3a322c] border-0 rounded-md',
          tableHead: 'text-[#7d6b56] text-xs border-0',
          breadcrumbs: 'text-[#7d6b56]',
          breadcrumbsItem: 'text-[#7d6b56] hover:text-[#a89f91] text-sm',
          breadcrumbsItemDivider: 'text-[#4a4039]',
          selectButton: 'bg-[#3a322c] border-0 text-[#ece5d8] rounded-md h-10',
          selectButtonIcon: 'text-[#7d6b56]',
          selectOptionsContainer: 'bg-[#3a322c] border border-[#4a4039] rounded-lg shadow-lg',
          selectOption: 'text-[#ece5d8] hover:bg-[#4a4039] px-3 py-2 text-sm',
          otpCodeFieldInput: 'bg-[#3a322c] border-0 text-[#ece5d8] rounded-md w-10 h-11 text-center text-lg focus:ring-1 focus:ring-[#c0a080]',
          accordionTriggerButton: 'text-[#ece5d8] hover:bg-[#3a322c] rounded-md p-2 transition-colors',
          accordionContent: 'bg-[#3a322c] rounded-md p-3 mt-1',
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}

