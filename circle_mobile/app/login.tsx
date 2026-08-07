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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

type AuthMethod = 'email' | 'phone';

export default function LoginPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const redirectTo = (params.redirect as string) || '/feed';

  // ── Email login state ──
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // ── Phone login state ──
  const [method, setMethod] = useState<AuthMethod>('email');
  const [phone, setPhone] = useState('');
  const [dialCode, setDialCode] = useState('+1');
  const [phoneStep, setPhoneStep] = useState<'step1' | 'step2'>('step1');
  const [phoneError, setPhoneError] = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [canResend, setCanResend] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  // ReturnType<typeof setInterval> works whether TS resolves setInterval
  // to the DOM (number) or Node (Timeout) typings
  const otpIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleEmailSubmit = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    setError('');
    setLoading(true);
    try {
      console.log('Logging in with:', email, password);
      Alert.alert('Success', 'Login successful!');
      // router.push(redirectTo);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // Shared OTP countdown logic — used by both send and resend
  const startOtpCountdown = () => {
    setPhoneStep('step2');
    setOtpTimer(30);
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
  };

  const handleSendPhoneOtp = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 5) {
      setPhoneError('Please enter a valid phone number.');
      return;
    }
    const fullPhone = dialCode + digits;
    setPhoneLoading(true);
    setPhoneError('');
    try {
      console.log('Sending OTP to:', fullPhone);
      startOtpCountdown();
      Alert.alert('OTP Sent', `Code sent to ${fullPhone}`);
    } catch (err: any) {
      setPhoneError(err.message || 'Failed to send OTP');
    } finally {
      setPhoneLoading(false);
    }
  };

  const handlePhoneVerify = async () => {
    if (otpCode.length !== 6) {
      setPhoneError('Please enter the complete 6-digit code');
      return;
    }
    const digits = phone.replace(/\D/g, '');
    const fullPhone = dialCode + digits;
    setPhoneLoading(true);
    setPhoneError('');
    try {
      console.log('Verifying OTP for:', fullPhone, otpCode);
      Alert.alert('Success', 'Phone verified!');
      // router.push(redirectTo);
    } catch (err: any) {
      setPhoneError(err.message || 'Invalid code');
      setOtpCode('');
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend) return;
    setCanResend(false);
    const digits = phone.replace(/\D/g, '');
    const fullPhone = dialCode + digits;
    setPhoneLoading(true);
    try {
      console.log('Resending OTP to:', fullPhone);
      startOtpCountdown();
    } catch (err: any) {
      setPhoneError(err.message || 'Failed to resend');
    } finally {
      setPhoneLoading(false);
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (otpIntervalRef.current) clearInterval(otpIntervalRef.current);
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <Text style={styles.title}>Welcome Back</Text>

            {/* Method Tabs */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                onPress={() => setMethod('email')}
                style={[styles.tab, method === 'email' && styles.tabActive]}
              >
                <Text style={[styles.tabText, method === 'email' && styles.tabTextActive]}>
                  Email
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMethod('phone')}
                style={[styles.tab, method === 'phone' && styles.tabActive]}
              >
                <Text style={[styles.tabText, method === 'phone' && styles.tabTextActive]}>
                  Phone
                </Text>
              </TouchableOpacity>
            </View>

            {/* ── Email Method ── */}
            {method === 'email' && (
              <View style={styles.form}>
                {error && <Text style={styles.errorText}>{error}</Text>}

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
                </View>

                <TouchableOpacity
                  onPress={handleEmailSubmit}
                  disabled={loading}
                  style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitButtonText}>Sign In</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.footerLinks}>
                  <TouchableOpacity onPress={() => router.push('/register')}>
                    <Text style={styles.linkText}>
                      Don't have an account? <Text style={styles.linkHighlight}>Register</Text>
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => router.push('/reset-password')}>
                    <Text style={[styles.linkText, styles.forgotPassword]}>
                      Forgot password?
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── Phone Method ── */}
            {method === 'phone' && (
              <View style={styles.form}>
                {phoneError && <Text style={styles.errorText}>{phoneError}</Text>}

                {phoneStep === 'step1' && (
                  <View>
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

                    <TouchableOpacity
                      onPress={handleSendPhoneOtp}
                      disabled={phoneLoading}
                      style={[styles.submitButton, phoneLoading && styles.submitButtonDisabled]}
                    >
                      {phoneLoading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.submitButtonText}>Send OTP</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {phoneStep === 'step2' && (
                  <View>
                    <Text style={styles.otpInfo}>
                      Enter the 6-digit code sent to {dialCode} {phone}
                    </Text>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>OTP Code</Text>
                      <TextInput
                        style={[styles.input, styles.otpInput]}
                        value={otpCode}
                        onChangeText={(text) => {
                          const cleaned = text.replace(/\D/g, '');
                          setOtpCode(cleaned);
                          if (cleaned.length === 6) {
                            handlePhoneVerify();
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
                        <TouchableOpacity onPress={handleResendOtp} disabled={!canResend}>
                          <Text style={[styles.resendLink, !canResend && styles.resendLinkDisabled]}>
                            Resend code
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <TouchableOpacity
                      onPress={() => setPhoneStep('step1')}
                      style={styles.backButton}
                    >
                      <Text style={styles.backButtonText}>← Change phone number</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
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
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footerLinks: {
    marginTop: 16,
    alignItems: 'center',
    gap: 8,
  },
  linkText: {
    fontSize: 14,
    color: '#666',
  },
  linkHighlight: {
    color: '#007AFF',
    fontWeight: '600',
  },
  forgotPassword: {
    marginTop: 4,
  },
  otpInfo: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  resendContainer: {
    alignItems: 'center',
    marginVertical: 12,
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
    marginTop: 8,
  },
  backButtonText: {
    fontSize: 14,
    color: '#666',
  },
});