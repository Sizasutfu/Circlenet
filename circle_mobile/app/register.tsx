import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

type AuthMethod = 'email' | 'phone';

export default function RegisterPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const redirectTo = (params.redirect as string) || '/feed';

  const [method, setMethod] = useState<AuthMethod>('email');

  // ── Email state ──
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'step1' | 'verify'>('step1');
  const [verifyEmailAddr, setVerifyEmailAddr] = useState('');
  const [otpTimer, setOtpTimer] = useState(0);
  const [canResend, setCanResend] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, label: '' });

  // ── Phone state ──
  const [phone, setPhone] = useState('');
  const [dialCode, setDialCode] = useState('+1');
  const [phoneName, setPhoneName] = useState('');
  const [phoneStep, setPhoneStep] = useState<'step1' | 'step2'>('step1');
  const [phoneError, setPhoneError] = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneOtpTimer, setPhoneOtpTimer] = useState(0);
  const [canResendPhone, setCanResendPhone] = useState(false);
  const [phoneOtpCode, setPhoneOtpCode] = useState('');

  const otpIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phoneOtpIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Password strength ──
  const checkStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;

    const capped = Math.min(score, 4);
    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
    return { score: capped, label: labels[capped] };
  };

  useEffect(() => {
    setPasswordStrength(checkStrength(password));
  }, [password]);

  // ── Email registration ──
  const handleEmailRegister = async () => {
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (!termsAccepted) {
      setError('Please accept the Terms of Service.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      console.log('Registering:', name, email, password);
      // await register(name, email, password);
      // await sendEmailVerification(email);
      setVerifyEmailAddr(email);
      setStep('verify');
      setOtpTimer(60);
      setCanResend(false);

      if (otpIntervalRef.current) clearInterval(otpIntervalRef.current);
      otpIntervalRef.current = setInterval(() => {
        setOtpTimer((prev) => {
          if (prev <= 1) {
            if (otpIntervalRef.current) clearInterval(otpIntervalRef.current);
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      Alert.alert('Verification Sent', `Code sent to ${email}`);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailVerify = async () => {
    if (otpCode.length !== 6) return;
    setLoading(true);
    try {
      console.log('Verifying email:', verifyEmailAddr, otpCode);
      // await verifyEmail(verifyEmailAddr, otpCode);
      Alert.alert('Success', 'Email verified!');
      // router.push(redirectTo);
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (!canResend) return;
    try {
      console.log('Resending verification to:', verifyEmailAddr);
      // await sendEmailVerification(verifyEmailAddr);
      setOtpTimer(60);
      setCanResend(false);
      if (otpIntervalRef.current) clearInterval(otpIntervalRef.current);
      otpIntervalRef.current = setInterval(() => {
        setOtpTimer((prev) => {
          if (prev <= 1) {
            if (otpIntervalRef.current) clearInterval(otpIntervalRef.current);
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setError('Failed to resend code.');
    }
  };

  // ── Phone registration ──
  const handlePhoneRegisterSend = async () => {
    const digits = phone.replace(/\D/g, '');
    if (!phoneName || phoneName.length < 2) {
      setPhoneError('Name must be at least 2 characters.');
      return;
    }
    if (digits.length < 5) {
      setPhoneError('Please enter a valid phone number.');
      return;
    }
    if (!termsAccepted) {
      setPhoneError('Please accept the Terms of Service.');
      return;
    }
    const fullPhone = dialCode + digits;
    setPhoneLoading(true);
    setPhoneError('');
    try {
      console.log('Registering phone:', fullPhone, phoneName);
      // await registerPhoneSendOtp(fullPhone, phoneName);
      setPhoneStep('step2');
      setPhoneOtpTimer(60);
      setCanResendPhone(false);

      if (phoneOtpIntervalRef.current) clearInterval(phoneOtpIntervalRef.current);
      phoneOtpIntervalRef.current = setInterval(() => {
        setPhoneOtpTimer((prev) => {
          if (prev <= 1) {
            if (phoneOtpIntervalRef.current) clearInterval(phoneOtpIntervalRef.current);
            setCanResendPhone(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      Alert.alert('OTP Sent', `Code sent to ${fullPhone}`);
    } catch (err: any) {
      setPhoneError(err.message || 'Failed to send code');
    } finally {
      setPhoneLoading(false);
    }
  };

  const handlePhoneRegisterVerify = async () => {
    if (phoneOtpCode.length !== 6) return;
    const digits = phone.replace(/\D/g, '');
    const fullPhone = dialCode + digits;
    setPhoneLoading(true);
    setPhoneError('');
    try {
      console.log('Verifying phone:', fullPhone, phoneOtpCode);
      // await registerPhoneVerifyOtp(fullPhone, phoneOtpCode, phoneName);
      Alert.alert('Success', 'Phone verified!');
      // router.push(redirectTo);
    } catch (err: any) {
      setPhoneError(err.message || 'Verification failed');
      setPhoneOtpCode('');
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleResendPhone = async () => {
    if (!canResendPhone) return;
    const digits = phone.replace(/\D/g, '');
    const fullPhone = dialCode + digits;
    setPhoneLoading(true);
    try {
      console.log('Resending OTP to:', fullPhone);
      // await registerPhoneSendOtp(fullPhone, phoneName);
      setPhoneOtpTimer(60);
      setCanResendPhone(false);
      if (phoneOtpIntervalRef.current) clearInterval(phoneOtpIntervalRef.current);
      phoneOtpIntervalRef.current = setInterval(() => {
        setPhoneOtpTimer((prev) => {
          if (prev <= 1) {
            if (phoneOtpIntervalRef.current) clearInterval(phoneOtpIntervalRef.current);
            setCanResendPhone(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      setPhoneError('Failed to resend code.');
    } finally {
      setPhoneLoading(false);
    }
  };

  // Cleanup intervals
  useEffect(() => {
    return () => {
      if (otpIntervalRef.current) clearInterval(otpIntervalRef.current);
      if (phoneOtpIntervalRef.current) clearInterval(phoneOtpIntervalRef.current);
    };
  }, []);

  // Password strength bar colors
  const getStrengthColor = (score: number) => {
    if (score === 0 || score === 1) return '#dc2626';
    if (score === 2) return '#f59e0b';
    if (score === 3) return '#3b82f6';
    return '#22c55e';
  };

  const getStrengthLabel = (score: number) => {
    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
    return labels[score] || '';
  };

  const getStrengthHint = (score: number) => {
    const hints = [
      'Add length, uppercase, lowercase, digits, or special characters.',
      'Add more variety (uppercase, digits, special).',
      'Good – add more length or special characters.',
      'Strong – almost there!',
      'Excellent – this password is very strong.',
    ];
    return hints[score] || '';
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <Text style={styles.title}>Create Account</Text>

            {/* Method Tabs */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                onPress={() => setMethod('email')}
                style={[styles.tab, method === 'email' && styles.tabActive]}
              >
                <Text style={[styles.tabText, method === 'email' && styles.tabTextActive]}>Email</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMethod('phone')}
                style={[styles.tab, method === 'phone' && styles.tabActive]}
              >
                <Text style={[styles.tabText, method === 'phone' && styles.tabTextActive]}>Phone</Text>
              </TouchableOpacity>
            </View>

            {/* ── Email Method ── */}
            {method === 'email' && (
              <>
                {step === 'step1' && (
                  <View style={styles.form}>
                    {error && <Text style={styles.errorText}>{error}</Text>}

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Name</Text>
                      <TextInput
                        style={styles.input}
                        value={name}
                        onChangeText={setName}
                        placeholder="Your name"
                        placeholderTextColor="#999"
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Email</Text>
                      <TextInput
                        style={styles.input}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="you@example.com"
                        placeholderTextColor="#999"
                        keyboardType="email-address"
                        autoCapitalize="none"
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Password</Text>
                      <View style={styles.passwordContainer}>
                        <TextInput
                          style={[styles.input, styles.passwordInput]}
                          value={password}
                          onChangeText={setPassword}
                          placeholder="••••••••"
                          placeholderTextColor="#999"
                          secureTextEntry={!showPassword}
                        />
                        <TouchableOpacity
                          onPress={() => setShowPassword(!showPassword)}
                          style={styles.eyeButton}
                        >
                          <Text>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Strength Meter */}
                      {password.length > 0 && (
                        <View style={styles.strengthContainer}>
                          <View style={styles.strengthBar}>
                            <View
                              style={[
                                styles.strengthFill,
                                {
                                  width: `${(passwordStrength.score / 4) * 100}%`,
                                  backgroundColor: getStrengthColor(passwordStrength.score),
                                },
                              ]}
                            />
                          </View>
                          <Text style={styles.strengthLabel}>{getStrengthLabel(passwordStrength.score)}</Text>
                        </View>
                      )}
                      {password.length > 0 && (
                        <Text style={styles.strengthHint}>{getStrengthHint(passwordStrength.score)}</Text>
                      )}
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Confirm Password</Text>
                      <View style={styles.passwordContainer}>
                        <TextInput
                          style={[styles.input, styles.passwordInput]}
                          value={confirmPassword}
                          onChangeText={setConfirmPassword}
                          placeholder="••••••••"
                          placeholderTextColor="#999"
                          secureTextEntry={!showConfirmPassword}
                        />
                        <TouchableOpacity
                          onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                          style={styles.eyeButton}
                        >
                          <Text>{showConfirmPassword ? '👁️' : '👁️‍🗨️'}</Text>
                        </TouchableOpacity>
                      </View>
                      {confirmPassword && password !== confirmPassword && (
                        <Text style={styles.matchError}>Passwords do not match.</Text>
                      )}
                    </View>

                    {/* Terms Checkbox */}
                    <View style={styles.termsContainer}>
                      <Switch
                        value={termsAccepted}
                        onValueChange={setTermsAccepted}
                        trackColor={{ false: '#d1d5db', true: '#007AFF' }}
                      />
                      <Text style={styles.termsText}>
                        I agree to the <Text style={styles.termsLink}>Terms of Service</Text>
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={handleEmailRegister}
                      disabled={loading || !termsAccepted}
                      style={[styles.submitButton, (loading || !termsAccepted) && styles.submitButtonDisabled]}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.submitButtonText}>Create Account</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() =>
                        router.push({
                          pathname: '/login',
                          params: redirectTo ? { redirect: redirectTo } : undefined,
                        })
                      }
                    >
                      <Text style={styles.footerText}>
                        Already have an account? <Text style={styles.footerLink}>Sign In</Text>
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {step === 'verify' && (
                  <View style={styles.form}>
                    <Text style={styles.otpInfo}>
                      We sent a 6-digit code to <Text style={styles.otpEmail}>{verifyEmailAddr}</Text>
                    </Text>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Verification Code</Text>
                      <TextInput
                        style={[styles.input, styles.otpInput]}
                        value={otpCode}
                        onChangeText={(text) => {
                          const cleaned = text.replace(/\D/g, '');
                          setOtpCode(cleaned);
                          if (cleaned.length === 6) {
                            handleEmailVerify();
                          }
                        }}
                        placeholder="000000"
                        placeholderTextColor="#999"
                        keyboardType="number-pad"
                        maxLength={6}
                      />
                    </View>

                    <View style={styles.resendContainer}>
                      {otpTimer > 0 ? (
                        <Text style={styles.resendText}>Resend in {otpTimer}s</Text>
                      ) : (
                        <TouchableOpacity onPress={handleResendEmail} disabled={!canResend}>
                          <Text style={[styles.resendLink, !canResend && styles.resendLinkDisabled]}>
                            Resend code
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {error && <Text style={styles.errorText}>{error}</Text>}

                    <TouchableOpacity onPress={() => setStep('step1')} style={styles.backButton}>
                      <Text style={styles.backButtonText}>← Change email</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            {/* ── Phone Method ── */}
            {method === 'phone' && (
              <>
                {phoneStep === 'step1' && (
                  <View style={styles.form}>
                    {phoneError && <Text style={styles.errorText}>{phoneError}</Text>}

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Name</Text>
                      <TextInput
                        style={styles.input}
                        value={phoneName}
                        onChangeText={setPhoneName}
                        placeholder="Your name"
                        placeholderTextColor="#999"
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Phone Number</Text>
                      <View style={styles.phoneContainer}>
                        <View style={styles.dialCodeContainer}>
                          <Text style={styles.dialCodeText}>{dialCode}</Text>
                        </View>
                        <TextInput
                          style={[styles.input, styles.phoneInput]}
                          value={phone}
                          onChangeText={(text) => setPhone(text.replace(/\D/g, ''))}
                          placeholder="Phone number (digits only)"
                          placeholderTextColor="#999"
                          keyboardType="phone-pad"
                        />
                      </View>
                    </View>

                    <View style={styles.termsContainer}>
                      <Switch
                        value={termsAccepted}
                        onValueChange={setTermsAccepted}
                        trackColor={{ false: '#d1d5db', true: '#007AFF' }}
                      />
                      <Text style={styles.termsText}>
                        I agree to the <Text style={styles.termsLink}>Terms of Service</Text>
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={handlePhoneRegisterSend}
                      disabled={phoneLoading || !termsAccepted}
                      style={[styles.submitButton, (phoneLoading || !termsAccepted) && styles.submitButtonDisabled]}
                    >
                      {phoneLoading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.submitButtonText}>Send OTP</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() =>
                        router.push({
                          pathname: '/login',
                          params: redirectTo ? { redirect: redirectTo } : undefined,
                        })
                      }
                    >
                      <Text style={styles.footerText}>
                        Already have an account? <Text style={styles.footerLink}>Sign In</Text>
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {phoneStep === 'step2' && (
                  <View style={styles.form}>
                    <Text style={styles.otpInfo}>
                      Enter the 6-digit code sent to {dialCode} {phone}
                    </Text>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Verification Code</Text>
                      <TextInput
                        style={[styles.input, styles.otpInput]}
                        value={phoneOtpCode}
                        onChangeText={(text) => {
                          const cleaned = text.replace(/\D/g, '');
                          setPhoneOtpCode(cleaned);
                          if (cleaned.length === 6) {
                            handlePhoneRegisterVerify();
                          }
                        }}
                        placeholder="000000"
                        placeholderTextColor="#999"
                        keyboardType="number-pad"
                        maxLength={6}
                      />
                    </View>

                    <View style={styles.resendContainer}>
                      {phoneOtpTimer > 0 ? (
                        <Text style={styles.resendText}>Resend in {phoneOtpTimer}s</Text>
                      ) : (
                        <TouchableOpacity onPress={handleResendPhone} disabled={!canResendPhone}>
                          <Text style={[styles.resendLink, !canResendPhone && styles.resendLinkDisabled]}>
                            Resend code
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {phoneError && <Text style={styles.errorText}>{phoneError}</Text>}

                    <TouchableOpacity onPress={() => setPhoneStep('step1')} style={styles.backButton}>
                      <Text style={styles.backButtonText}>← Change phone number</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 24,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#fff',
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
    color: '#1a1a1a',
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeButton: {
    position: 'absolute',
    right: 14,
    top: '50%',
    transform: [{ translateY: -12 }],
  },
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  strengthHint: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  matchError: {
    fontSize: 12,
    color: '#dc2626',
    marginTop: 2,
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dialCodeContainer: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRightWidth: 0,
    borderRadius: 8,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dialCodeText: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  phoneInput: {
    flex: 1,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  otpInput: {
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 8,
  },
  otpInfo: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  otpEmail: {
    fontWeight: '600',
    color: '#1a1a1a',
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  termsText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  termsLink: {
    color: '#007AFF',
    fontWeight: '500',
  },
  errorText: {
    color: '#dc2626',
    backgroundColor: '#fee2e2',
    padding: 10,
    borderRadius: 8,
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footerText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
  },
  footerLink: {
    color: '#007AFF',
    fontWeight: '600',
  },
  resendContainer: {
    alignItems: 'center',
  },
  resendText: {
    fontSize: 14,
    color: '#999',
  },
  resendLink: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  resendLinkDisabled: {
    color: '#999',
  },
  backButton: {
    alignItems: 'center',
    marginTop: 4,
  },
  backButtonText: {
    fontSize: 14,
    color: '#666',
  },
});