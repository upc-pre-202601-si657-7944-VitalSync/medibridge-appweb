import { httpClient } from '@/shared/api/httpClient'
import type {
  Appointment,
  AuthenticatedUser,
  ClinicalAlert,
  ClinicalReport,
  ChatMessage,
  CheckoutSessionResponse,
  ConfirmCheckoutSessionRequest,
  ConnectedUser,
  ConnectUserRequest,
  CreateCheckoutSessionRequest,
  CreateMedicationScheduleRequest,
  CreateSubscriptionRequest,
  DashboardMetrics,
  DoctorPatientAssignment,
  DoctorProfile,
  DoseAdministration,
  GenerateReportRequest,
  HealthObservation,
  HealthSummary,
  Invoice,
  LowStockAlert,
  Medication,
  MedicationSchedule,
  Notification,
  PatientProfile,
  ProfileChatContact,
  RecordDoseAdministrationRequest,
  RecordHealthObservationRequest,
  RegisterMedicationRequest,
  RoleResource,
  ScheduleMedicalAppointmentRequest,
  SendChatMessageRequest,
  SignInRequest,
  SignUpRequest,
  SkipDoseRequest,
  Subscription,
  UpdateMedicationRequest,
  UpdateMedicationStockRequest,
  UserResource,
} from '@/shared/types/api'

export const authApi = {
  async signIn(payload: SignInRequest) {
    const { data } = await httpClient.post<AuthenticatedUser>(
      '/api/v1/authentication/sign-in',
      payload,
    )
    return data
  },
  async signUp(payload: SignUpRequest) {
    const { data } = await httpClient.post<UserResource>(
      '/api/v1/authentication/sign-up',
      payload,
    )
    return data
  },
  async getUser(userId: number) {
    const { data } = await httpClient.get<UserResource>(`/api/v1/users/${userId}`)
    return data
  },
  async listRoles() {
    const { data } = await httpClient.get<RoleResource[]>('/api/v1/roles')
    return data
  },
}

export const profilesApi = {
  async createDoctor(payload: { fullName: string }) {
    const { data } = await httpClient.post<DoctorProfile>('/api/v1/profiles/doctors', payload)
    return data
  },
  async getDoctor(doctorProfileId: number) {
    const { data } = await httpClient.get<DoctorProfile>(
      `/api/v1/profiles/doctors/${doctorProfileId}`,
    )
    return data
  },
  async getCurrentDoctor() {
    const { data } = await httpClient.get<DoctorProfile>('/api/v1/profiles/doctors/me')
    return data
  },
  async createPatient(payload: { fullName: string }) {
    const { data } = await httpClient.post<PatientProfile>('/api/v1/profiles/patients', payload)
    return data
  },
  async createAssignedPatient(payload: { fullName: string }) {
    const { data } = await httpClient.post<PatientProfile>(
      '/api/v1/profiles/patients/assigned-to-me',
      payload,
    )
    return data
  },
  async getPatient(patientId: number) {
    const { data } = await httpClient.get<PatientProfile>(
      `/api/v1/profiles/patients/${patientId}`,
    )
    return data
  },
  async listMyPatients() {
    const { data } = await httpClient.get<PatientProfile[]>('/api/v1/profiles/patients/my-care-team')
    return data
  },
  async listChatContacts() {
    const { data } = await httpClient.get<ProfileChatContact[]>('/api/v1/profiles/chat-contacts')
    return data
  },
  async assignDoctor(patientId: number, doctorProfileId: number) {
    const { data } = await httpClient.post<DoctorPatientAssignment>(
      `/api/v1/profiles/patients/${patientId}/doctors/${doctorProfileId}`,
    )
    return data
  },
}

export const paymentsApi = {
  async createSubscription(payload: CreateSubscriptionRequest) {
    const { data } = await httpClient.post<Subscription>('/api/v1/subscriptions', payload)
    return data
  },
  async createCheckoutSession(payload: CreateCheckoutSessionRequest) {
    const { data } = await httpClient.post<CheckoutSessionResponse>(
      '/api/v1/subscriptions/checkout',
      payload,
    )
    return data
  },
  async confirmCheckoutSession(payload: ConfirmCheckoutSessionRequest) {
    const { data } = await httpClient.post<Subscription>(
      '/api/v1/subscriptions/checkout/confirm',
      payload,
    )
    return data
  },
  async approveMockSubscription(payload: CreateCheckoutSessionRequest) {
    const { data } = await httpClient.post<Subscription>(
      '/api/v1/subscriptions/mock/approve',
      payload,
    )
    return data
  },
  async getActiveSubscription(userId: number) {
    const { data } = await httpClient.get<Subscription>(
      `/api/v1/subscriptions/users/${userId}/active`,
    )
    return data
  },
  async listSubscriptions(userId: number) {
    const { data } = await httpClient.get<Subscription | Subscription[]>(
      `/api/v1/subscriptions/users/${userId}`,
    )
    return Array.isArray(data) ? data : [data]
  },
  async listInvoices(userId: number) {
    const { data } = await httpClient.get<Invoice[]>(`/api/v1/invoices/users/${userId}`)
    return data
  },
  async cancelSubscription(subscriptionId: number) {
    const { data } = await httpClient.post<Subscription>(
      `/api/v1/subscriptions/${subscriptionId}/cancel`,
    )
    return data
  },
  async renewSubscription(subscriptionId: number) {
    const { data } = await httpClient.post<Subscription>(
      `/api/v1/subscriptions/${subscriptionId}/renew`,
    )
    return data
  },
}

export const appointmentsApi = {
  async createMedicalAppointment(payload: ScheduleMedicalAppointmentRequest) {
    const { data } = await httpClient.post<Appointment>('/api/v1/appointments/medical', payload)
    return data
  },
  async getAppointment(appointmentId: number) {
    const { data } = await httpClient.get<Appointment>(`/api/v1/appointments/${appointmentId}`)
    return data
  },
  async listPatientAppointments(patientId: number) {
    const { data } = await httpClient.get<Appointment[]>(
      `/api/v1/appointments/patient/${patientId}`,
    )
    return data
  },
}

export const medicationApi = {
  async registerMedication(payload: RegisterMedicationRequest) {
    const { data } = await httpClient.post<Medication>('/api/v1/medications', payload)
    return data
  },
  async getMedication(medicationId: number) {
    const { data } = await httpClient.get<Medication>(`/api/v1/medications/${medicationId}`)
    return data
  },
  async listPatientMedications(patientId: number) {
    const { data } = await httpClient.get<Medication[]>(
      `/api/v1/medications/patients/${patientId}`,
    )
    return data
  },
  async updateStock(medicationId: number, payload: UpdateMedicationStockRequest) {
    const { data } = await httpClient.patch<Medication>(
      `/api/v1/medications/${medicationId}/stock`,
      payload,
    )
    return data
  },
  async updateMedication(medicationId: number, payload: UpdateMedicationRequest) {
    const { data } = await httpClient.patch<Medication>(
      `/api/v1/medications/${medicationId}`,
      payload,
    )
    return data
  },
  async deleteMedication(medicationId: number) {
    await httpClient.delete(`/api/v1/medications/${medicationId}`)
  },
  async listLowStock(patientId: number) {
    const { data } = await httpClient.get<LowStockAlert[]>(
      `/api/v1/medications/patients/${patientId}/low-stock`,
    )
    return data
  },
  async createSchedule(payload: CreateMedicationScheduleRequest) {
    const { data } = await httpClient.post<MedicationSchedule>(
      '/api/v1/medication-schedules',
      payload,
    )
    return data
  },
  async listActiveSchedules(patientId: number) {
    const { data } = await httpClient.get<MedicationSchedule[]>(
      `/api/v1/medication-schedules/patients/${patientId}/active`,
    )
    return data
  },
  async recordDose(payload: RecordDoseAdministrationRequest) {
    const { data } = await httpClient.post<DoseAdministration>(
      '/api/v1/dose-administrations',
      payload,
    )
    return data
  },
  async skipDose(payload: SkipDoseRequest) {
    const { data } = await httpClient.post<DoseAdministration>(
      '/api/v1/dose-administrations/skip',
      payload,
    )
    return data
  },
  async listDoseHistory(medicationId: number) {
    const { data } = await httpClient.get<DoseAdministration[]>(
      `/api/v1/dose-administrations/medications/${medicationId}`,
    )
    return data
  },
}

export const healthApi = {
  async recordObservation(patientId: number, payload: RecordHealthObservationRequest) {
    const { data } = await httpClient.post<HealthObservation>(
      `/api/v1/health-monitoring/patients/${patientId}/observations`,
      payload,
    )
    return data
  },
  async listObservations(patientId: number) {
    const { data } = await httpClient.get<HealthObservation[]>(
      `/api/v1/health-monitoring/patients/${patientId}/observations`,
    )
    return data
  },
  async listActiveAlerts(patientId: number) {
    const { data } = await httpClient.get<ClinicalAlert[]>(
      `/api/v1/health-monitoring/patients/${patientId}/alerts/active`,
    )
    return data
  },
  async getSummary(patientId: number) {
    const { data } = await httpClient.get<HealthSummary>(
      `/api/v1/health-monitoring/patients/${patientId}/summary`,
    )
    return data
  },
}

export const reportsApi = {
  async generateReport(payload: GenerateReportRequest) {
    const { data } = await httpClient.post<ClinicalReport>('/api/v1/clinical-reports', payload)
    return data
  },
  async generatePdf(reportId: number) {
    await httpClient.post(`/api/v1/clinical-reports/${reportId}/pdf`)
  },
  async downloadPdf(reportId: number) {
    const { data } = await httpClient.get<Blob>(`/api/v1/clinical-reports/${reportId}/pdf`, {
      responseType: 'blob',
    })
    return data
  },
  async getReport(reportId: number) {
    const { data } = await httpClient.get<ClinicalReport>(`/api/v1/clinical-reports/${reportId}`)
    return data
  },
  async listReports(patientId: number) {
    const { data } = await httpClient.get<ClinicalReport[]>(
      `/api/v1/clinical-reports/patients/${patientId}`,
    )
    return data
  },
  async getDashboard(patientId: number) {
    const { data } = await httpClient.get<DashboardMetrics>(
      `/api/v1/analytics-dashboards/patients/${patientId}`,
    )
    return data
  },
}

export const communicationApi = {
  async sendMessage(payload: SendChatMessageRequest) {
    const { data } = await httpClient.post<ChatMessage>('/api/v1/chat/messages', payload)
    return data
  },
  async getConversation(senderUserId: number, recipientUserId: number) {
    const { data } = await httpClient.get<ChatMessage[]>(
      `/api/v1/chat/messages/${senderUserId}/${recipientUserId}`,
    )
    return data
  },
  async connect(payload: ConnectUserRequest) {
    const { data } = await httpClient.post<ConnectedUser>('/api/v1/chat/users/connect', payload)
    return data
  },
  async disconnect(payload: ConnectUserRequest) {
    await httpClient.post('/api/v1/chat/users/disconnect', payload)
  },
  async listConnectedUsers() {
    const { data } = await httpClient.get<ConnectedUser[]>('/api/v1/chat/users/connected')
    return data
  },
  async listNotifications(recipientUserId: number) {
    const { data } = await httpClient.get<Notification[]>(
      `/api/v1/notifications/recipients/${recipientUserId}`,
    )
    return data
  },
  async listUnreadNotifications(recipientUserId: number) {
    const { data } = await httpClient.get<Notification[]>(
      `/api/v1/notifications/recipients/${recipientUserId}/unread`,
    )
    return data
  },
  async markNotificationRead(notificationId: string) {
    const { data } = await httpClient.patch<Notification>(
      `/api/v1/notifications/${notificationId}/read`,
    )
    return data
  },
}
