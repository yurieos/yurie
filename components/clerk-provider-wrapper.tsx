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
          // Brand colors matching Vintage Paper theme
          colorPrimary: '#c0a080',
          colorDanger: '#b54a35',
          colorSuccess: '#22c55e',
          colorWarning: '#f59e0b',
          
          // Dark theme backgrounds (Vintage Paper dark)
          colorBackground: '#2d2621',
          colorInputBackground: '#3a322c',
          colorInputText: '#ece5d8',
          colorText: '#ece5d8',
          colorTextOnPrimaryBackground: '#2d2621',
          colorTextSecondary: '#c5bcac',
          
          // Styling
          borderRadius: '0.25rem',
          colorNeutral: '#c5bcac',
          spacingUnit: '0.875rem',
          fontFamily: '"Libre Baskerville", serif',
        },
        elements: {
          // Root & Card - matching Vintage Paper style
          rootBox: 'font-sans',
          card: 'bg-[#3a322c] border border-[#4a4039] shadow-2xl rounded-lg',
          
          // Modal - warm dark overlay
          modalBackdrop: 'bg-[#2d2621]/90 backdrop-blur-sm',
          modalContent: 'bg-[#3a322c] border border-[#4a4039] rounded-lg shadow-2xl',
          modalCloseButton: 'text-[#c5bcac] hover:text-[#ece5d8] hover:bg-[#59493e] rounded-lg p-2 transition-all duration-200',
          
          // Headers - clean typography
          headerTitle: 'text-[#ece5d8] text-xl font-semibold tracking-tight',
          headerSubtitle: 'text-[#c5bcac] text-sm',
          
          // Navbar - seamless with app sidebar style
          navbar: 'bg-[#2d2621] border-0 p-2',
          navbarButton: 'text-[#c5bcac] hover:text-[#ece5d8] hover:bg-[#3a322c] rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200',
          navbarButtonIcon: 'text-[#c5bcac] w-4 h-4',
          navbarButtons: 'gap-1',
          'navbarButton__active': 'bg-[#3a322c] text-[#ece5d8]',
          'navbarButtonIcon__active': 'text-[#c0a080]',
          
          // Page - consistent dark background
          pageScrollBox: 'bg-[#2d2621] px-6 py-6',
          page: 'bg-[#2d2621]',
          profilePage: 'bg-[#2d2621]',
          
          // Sections - clean separation
          profileSection: 'border-0 pb-6 mb-4',
          profileSectionTitle: 'text-[#c5bcac] text-xs uppercase tracking-widest font-semibold mb-4',
          profileSectionTitleText: 'text-[#c5bcac]',
          profileSectionContent: 'space-y-2',
          profileSectionPrimaryButton: 'text-[#ece5d8] hover:text-[#c0a080] text-sm font-medium transition-colors duration-200',
          
          // Forms - matching app input style
          formButtonPrimary: 'bg-[#c0a080] hover:bg-[#b3906f] text-[#2d2621] font-semibold rounded-lg h-11 px-6 text-sm transition-all duration-200 shadow-lg shadow-[#c0a080]/20 hover:shadow-[#c0a080]/30',
          formButtonReset: 'text-[#c5bcac] hover:text-[#ece5d8] text-sm font-medium transition-colors duration-200',
          formFieldInput: 'bg-[#3a322c] border border-[#4a4039] text-[#ece5d8] placeholder:text-[#7d6b56] rounded-lg h-11 px-4 text-sm focus:ring-2 focus:ring-[#c0a080]/50 focus:border-[#c0a080] transition-all duration-200',
          formFieldLabel: 'text-[#c5bcac] text-sm font-medium mb-2',
          formFieldAction: 'text-[#c0a080] hover:text-[#b3906f] text-sm font-medium transition-colors duration-200',
          formFieldInputShowPasswordButton: 'text-[#c5bcac] hover:text-[#ece5d8] transition-colors',
          formFieldSuccessText: 'text-[#22c55e] text-sm',
          formFieldErrorText: 'text-[#b54a35] text-sm',
          formResendCodeLink: 'text-[#c0a080] hover:text-[#b3906f] text-sm font-medium transition-colors',
          
          // Buttons - consistent with app buttons
          button: 'transition-all duration-200',
          buttonArrowIcon: 'text-[#c5bcac]',
          
          // Menus - warm dropdown style
          menuButton: 'text-[#c5bcac] hover:text-[#ece5d8] rounded-lg p-2 transition-all duration-200',
          menuList: 'bg-[#3a322c] border border-[#4a4039] rounded-lg shadow-2xl py-2',
          menuItem: 'text-[#ece5d8] hover:bg-[#59493e] px-4 py-2.5 text-sm font-medium transition-all duration-200',
          
          // Social buttons - matching app style
          socialButtonsBlockButton: 'bg-[#3a322c] hover:bg-[#59493e] border border-[#4a4039] text-[#ece5d8] rounded-lg h-11 text-sm font-medium transition-all duration-200',
          socialButtonsBlockButtonText: 'text-[#ece5d8] text-sm font-medium',
          socialButtonsProviderIcon: 'w-5 h-5',
          
          // Dividers - subtle
          dividerLine: 'bg-[#4a4039]',
          dividerText: 'text-[#7d6b56] text-xs font-medium',
          
          // User preview in profile modal
          userButtonBox: 'relative',
          
          // User preview in modals
          userPreviewMainIdentifier: 'text-[#ece5d8] font-semibold text-base',
          userPreviewSecondaryIdentifier: 'text-[#c5bcac] text-sm',
          userPreview: 'gap-3',
          userPreviewAvatarBox: 'w-12 h-12 ring-2 ring-[#4a4039]',
          userPreviewAvatarImage: 'rounded-full',
          userPreviewTextContainer: 'gap-1',
          
          // Avatar - consistent with app
          avatarBox: 'rounded-full ring-2 ring-[#4a4039]',
          avatarImage: 'rounded-full',
          
          // Badges - matching app style
          badge: 'bg-[#3a322c] text-[#c5bcac] border border-[#4a4039] rounded-lg px-2.5 py-1 text-xs font-medium',
          tagInputContainer: 'bg-[#3a322c] border border-[#4a4039] rounded-lg',
          tagPillContainer: 'bg-[#3a322c] text-[#ece5d8] border border-[#4a4039] rounded-lg',
          
          // Alerts - matching destructive colors
          alert: 'bg-[#3a322c] border border-[#4a4039] rounded-lg p-4',
          alertText: 'text-[#ece5d8] text-sm',
          
          // Identity preview
          identityPreview: 'bg-transparent p-0',
          identityPreviewText: 'text-[#ece5d8] text-sm font-medium',
          identityPreviewEditButton: 'text-[#c0a080] hover:text-[#b3906f] text-sm font-medium transition-colors',
          identityPreviewEditButtonIcon: 'text-[#c0a080] w-4 h-4',
          
          // Footer - hidden for cleaner look
          footer: 'hidden',
          footerAction: 'hidden',
          footerActionLink: 'hidden',
          footerActionText: 'hidden',
          footerPages: 'hidden',
          
          // Misc elements
          scrollBox: 'scrollbar-none',
          phoneInputBox: 'bg-[#3a322c] border border-[#4a4039] rounded-lg',
          tableHead: 'text-[#c5bcac] text-xs font-semibold uppercase tracking-wider border-0',
          breadcrumbs: 'text-[#c5bcac]',
          breadcrumbsItem: 'text-[#c5bcac] hover:text-[#ece5d8] text-sm font-medium transition-colors',
          breadcrumbsItemDivider: 'text-[#4a4039]',
          selectButton: 'bg-[#3a322c] border border-[#4a4039] text-[#ece5d8] rounded-lg h-11',
          selectButtonIcon: 'text-[#c5bcac]',
          selectOptionsContainer: 'bg-[#3a322c] border border-[#4a4039] rounded-lg shadow-2xl',
          selectOption: 'text-[#ece5d8] hover:bg-[#59493e] px-4 py-2.5 text-sm font-medium transition-colors',
          otpCodeFieldInput: 'bg-[#3a322c] border border-[#4a4039] text-[#ece5d8] rounded-lg w-12 h-14 text-center text-xl font-semibold focus:ring-2 focus:ring-[#c0a080]/50 focus:border-[#c0a080] transition-all',
          accordionTriggerButton: 'text-[#ece5d8] hover:bg-[#59493e] rounded-lg p-3 transition-all duration-200',
          accordionContent: 'bg-[#3a322c] rounded-lg p-4 mt-2',
          
          // Active session card
          activeDeviceIcon: 'text-[#c0a080]',
          activeDevice: 'bg-[#3a322c] border border-[#4a4039] rounded-lg p-4',
          
          // Verification
          verificationLinkStatusBox: 'bg-[#3a322c] border border-[#4a4039] rounded-lg',
          verificationLinkStatusIconBox: 'bg-[#c0a080]/20 rounded-full',
          verificationLinkStatusIcon: 'text-[#c0a080]',
          verificationLinkStatusText: 'text-[#ece5d8]',
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
