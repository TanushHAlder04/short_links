export function authErrorMessage(code) {
  if (!code) return ''
  if (code === 'OAuthAccountNotLinked') return 'This email already has an account. Sign in using the provider you originally used.'
  if (code === 'AccessDenied') return 'Sign-in was denied. Please try again and grant the requested access.'
  return 'Sign-in could not be completed. Please try again. If it continues, contact support.'
}
