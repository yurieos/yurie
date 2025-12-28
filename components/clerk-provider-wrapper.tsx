'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { useTheme } from 'next-themes';
import { ReactNode, useEffect, useState } from 'react';

interface ClerkProviderWrapperProps {
  children: ReactNode;
}

// Light theme appearance configuration (Vintage Paper light)
const lightAppearance = {
  variables: {
    // Brand colors matching Vintage Paper theme
    colorPrimary: '#a67c52',
    colorDanger: '#b54a35',
    colorSuccess: '#22c55e',
    colorWarning: '#f59e0b',
    
    // Light theme backgrounds (Vintage Paper light)
    colorBackground: '#ece5d8',
    colorInputBackground: '#fffcf5',
    colorInputText: '#4a3f35',
    colorText: '#4a3f35',
    colorTextOnPrimaryBackground: '#ffffff',
    colorTextSecondary: '#7d6b56',
    
    // Styling
    borderRadius: '0.75rem',
    colorNeutral: '#7d6b56',
    spacingUnit: '0.875rem',
    fontFamily: '"Libre Baskerville", serif',
  },
  elements: {
    // Root & Card - matching Vintage Paper light style
    rootBox: 'font-sans',
    card: 'bg-[#fffcf5] border border-[#dbd0ba] shadow-2xl rounded-xl',
    
    // Modal - warm light overlay
    modalBackdrop: 'bg-[#4a3f35]/60 backdrop-blur-sm',
    modalContent: 'bg-[#fffcf5] border border-[#dbd0ba] rounded-xl shadow-2xl',
    modalCloseButton: 'text-[#7d6b56] hover:text-[#4a3f35] hover:bg-[#ece5d8] rounded-lg p-2 transition-all duration-200',
    
    // Headers - clean typography
    headerTitle: 'text-[#4a3f35] text-xl font-semibold tracking-tight',
    headerSubtitle: 'text-[#7d6b56] text-sm',
    
    // Navbar - seamless with app sidebar style
    navbar: 'bg-[#ece5d8] border-0 p-2',
    navbarButton: 'text-[#7d6b56] hover:text-[#4a3f35] hover:bg-[#d4c8aa] rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200',
    navbarButtonIcon: 'text-[#7d6b56] w-4 h-4',
    navbarButtons: 'gap-1',
    'navbarButton__active': 'bg-[#d4c8aa] text-[#4a3f35]',
    'navbarButtonIcon__active': 'text-[#a67c52]',
    
    // Page - consistent light background
    pageScrollBox: 'bg-[#fffcf5] px-6 py-6',
    page: 'bg-[#fffcf5]',
    profilePage: 'bg-[#fffcf5]',
    
    // Sections - clean separation
    profileSection: 'border-0 pb-6 mb-4',
    profileSectionTitle: 'text-[#7d6b56] text-xs uppercase tracking-widest font-semibold mb-4',
    profileSectionTitleText: 'text-[#7d6b56]',
    profileSectionContent: 'space-y-2',
    profileSectionPrimaryButton: 'text-[#4a3f35] hover:text-[#a67c52] text-sm font-medium transition-colors duration-200',
    
    // Forms - matching app input style
    formButtonPrimary: 'bg-[#a67c52] hover:bg-[#8d6e4c] text-white font-semibold rounded-lg h-11 px-6 text-sm transition-all duration-200 shadow-lg shadow-[#a67c52]/20 hover:shadow-[#a67c52]/30',
    formButtonReset: 'text-[#7d6b56] hover:text-[#4a3f35] text-sm font-medium transition-colors duration-200',
    formFieldInput: 'bg-[#fffcf5] border border-[#dbd0ba] text-[#4a3f35] placeholder:text-[#b3a48f] rounded-lg h-11 px-4 text-sm focus:ring-2 focus:ring-[#a67c52]/50 focus:border-[#a67c52] transition-all duration-200',
    formFieldLabel: 'text-[#7d6b56] text-sm font-medium mb-2',
    formFieldAction: 'text-[#a67c52] hover:text-[#8d6e4c] text-sm font-medium transition-colors duration-200',
    formFieldInputShowPasswordButton: 'text-[#7d6b56] hover:text-[#4a3f35] transition-colors',
    formFieldSuccessText: 'text-[#22c55e] text-sm',
    formFieldErrorText: 'text-[#b54a35] text-sm',
    formResendCodeLink: 'text-[#a67c52] hover:text-[#8d6e4c] text-sm font-medium transition-colors',
    
    // Buttons - consistent with app buttons
    button: 'transition-all duration-200',
    buttonArrowIcon: 'text-[#7d6b56]',
    
    // Menus - warm dropdown style
    menuButton: 'text-[#7d6b56] hover:text-[#4a3f35] rounded-lg p-2 transition-all duration-200',
    menuList: 'bg-[#fffcf5] border border-[#dbd0ba] rounded-xl shadow-2xl py-2',
    menuItem: 'text-[#4a3f35] hover:bg-[#ece5d8] px-4 py-2.5 text-sm font-medium transition-all duration-200',
    
    // Social buttons - matching app style
    socialButtonsBlockButton: 'bg-[#fffcf5] hover:bg-[#ece5d8] border border-[#dbd0ba] text-[#4a3f35] rounded-lg h-11 text-sm font-medium transition-all duration-200',
    socialButtonsBlockButtonText: 'text-[#4a3f35] text-sm font-medium',
    socialButtonsProviderIcon: 'w-5 h-5',
    
    // Dividers - subtle
    dividerLine: 'bg-[#dbd0ba]',
    dividerText: 'text-[#b3a48f] text-xs font-medium',
    
    // User preview in modals
    userPreviewMainIdentifier: 'text-[#4a3f35] font-semibold text-base',
    userPreviewSecondaryIdentifier: 'text-[#7d6b56] text-sm',
    userPreview: 'gap-3',
    userPreviewAvatarBox: 'w-12 h-12 ring-2 ring-[#dbd0ba]',
    userPreviewAvatarImage: 'rounded-full',
    userPreviewTextContainer: 'gap-1',
    
    // Avatar - consistent with app
    avatarBox: 'rounded-full ring-2 ring-[#dbd0ba]',
    avatarImage: 'rounded-full',
    
    // Badges - matching app style
    badge: 'bg-[#ece5d8] text-[#7d6b56] border border-[#dbd0ba] rounded-lg px-2.5 py-1 text-xs font-medium',
    tagInputContainer: 'bg-[#fffcf5] border border-[#dbd0ba] rounded-lg',
    tagPillContainer: 'bg-[#ece5d8] text-[#4a3f35] border border-[#dbd0ba] rounded-lg',
    
    // Alerts - matching colors
    alert: 'bg-[#fffcf5] border border-[#dbd0ba] rounded-lg p-4',
    alertText: 'text-[#4a3f35] text-sm',
    
    // Identity preview
    identityPreview: 'bg-transparent p-0',
    identityPreviewText: 'text-[#4a3f35] text-sm font-medium',
    identityPreviewEditButton: 'text-[#a67c52] hover:text-[#8d6e4c] text-sm font-medium transition-colors',
    identityPreviewEditButtonIcon: 'text-[#a67c52] w-4 h-4',
    
    // Footer - hidden for cleaner look
    footer: 'hidden',
    footerAction: 'hidden',
    footerActionLink: 'hidden',
    footerActionText: 'hidden',
    footerPages: 'hidden',
    
    // Misc elements
    scrollBox: 'scrollbar-none',
    phoneInputBox: 'bg-[#fffcf5] border border-[#dbd0ba] rounded-lg',
    tableHead: 'text-[#7d6b56] text-xs font-semibold uppercase tracking-wider border-0',
    breadcrumbs: 'text-[#7d6b56]',
    breadcrumbsItem: 'text-[#7d6b56] hover:text-[#4a3f35] text-sm font-medium transition-colors',
    breadcrumbsItemDivider: 'text-[#dbd0ba]',
    selectButton: 'bg-[#fffcf5] border border-[#dbd0ba] text-[#4a3f35] rounded-lg h-11',
    selectButtonIcon: 'text-[#7d6b56]',
    selectOptionsContainer: 'bg-[#fffcf5] border border-[#dbd0ba] rounded-xl shadow-2xl',
    selectOption: 'text-[#4a3f35] hover:bg-[#ece5d8] px-4 py-2.5 text-sm font-medium transition-colors',
    otpCodeFieldInput: 'bg-[#fffcf5] border border-[#dbd0ba] text-[#4a3f35] rounded-lg w-12 h-14 text-center text-xl font-semibold focus:ring-2 focus:ring-[#a67c52]/50 focus:border-[#a67c52] transition-all',
    accordionTriggerButton: 'text-[#4a3f35] hover:bg-[#ece5d8] rounded-lg p-3 transition-all duration-200',
    accordionContent: 'bg-[#ece5d8] rounded-lg p-4 mt-2',
    
    // Active session card
    activeDeviceIcon: 'text-[#a67c52]',
    activeDevice: 'bg-[#ece5d8] border border-[#dbd0ba] rounded-lg p-4',
    
    // Verification
    verificationLinkStatusBox: 'bg-[#ece5d8] border border-[#dbd0ba] rounded-lg',
    verificationLinkStatusIconBox: 'bg-[#a67c52]/20 rounded-full',
    verificationLinkStatusIcon: 'text-[#a67c52]',
    verificationLinkStatusText: 'text-[#4a3f35]',
  },
};

// Dark theme appearance configuration (Vintage Paper dark)
const darkAppearance = {
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
    borderRadius: '0.75rem',
    colorNeutral: '#c5bcac',
    spacingUnit: '0.875rem',
    fontFamily: '"Libre Baskerville", serif',
  },
  elements: {
    // Root & Card - matching Vintage Paper style
    rootBox: 'font-sans',
    card: 'bg-[#3a322c] border border-[#4a4039] shadow-2xl rounded-xl',
    
    // Modal - warm dark overlay
    modalBackdrop: 'bg-[#2d2621]/90 backdrop-blur-sm',
    modalContent: 'bg-[#3a322c] border border-[#4a4039] rounded-xl shadow-2xl',
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
    pageScrollBox: 'bg-[#3a322c] px-6 py-6',
    page: 'bg-[#3a322c]',
    profilePage: 'bg-[#3a322c]',
    
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
    menuList: 'bg-[#3a322c] border border-[#4a4039] rounded-xl shadow-2xl py-2',
    menuItem: 'text-[#ece5d8] hover:bg-[#59493e] px-4 py-2.5 text-sm font-medium transition-all duration-200',
    
    // Social buttons - matching app style
    socialButtonsBlockButton: 'bg-[#3a322c] hover:bg-[#59493e] border border-[#4a4039] text-[#ece5d8] rounded-lg h-11 text-sm font-medium transition-all duration-200',
    socialButtonsBlockButtonText: 'text-[#ece5d8] text-sm font-medium',
    socialButtonsProviderIcon: 'w-5 h-5',
    
    // Dividers - subtle
    dividerLine: 'bg-[#4a4039]',
    dividerText: 'text-[#7d6b56] text-xs font-medium',
    
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
    selectOptionsContainer: 'bg-[#3a322c] border border-[#4a4039] rounded-xl shadow-2xl',
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
};

// Inner component that uses the theme hook
function ClerkProviderInner({ children, publishableKey }: { children: ReactNode; publishableKey: string }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Use dark theme as default during SSR/initial load, then switch based on resolved theme
  const appearance = mounted && resolvedTheme === 'light' ? lightAppearance : darkAppearance;

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      appearance={appearance}
    >
      {children}
    </ClerkProvider>
  );
}

export function ClerkProviderWrapper({ children }: ClerkProviderWrapperProps) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    return <>{children}</>;
  }

  return (
    <ClerkProviderInner publishableKey={publishableKey}>
      {children}
    </ClerkProviderInner>
  );
}
