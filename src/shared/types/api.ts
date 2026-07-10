export type RoleName = 'ROLE_USER' | 'ROLE_ADMIN'

export type AuthenticatedUser = {
  id: number
  username: string
  token: string
}

export type UserResource = {
  id: number
  username: string
  roles: RoleName[]
}

export type RoleResource = {
  id: number
  name: RoleName
}

export type SignInRequest = {
  username: string
  password: string
}

export type SignUpRequest = {
  username: string
  password: string
  roles: RoleName[]
}

export type DoctorProfile = {
  id: number
  userId: number
  fullName: string
}

export type PatientProfile = {
  id: number
  userId?: number | null
  fullName: string
}

export type ProfileChatContact = {
  userId: number
  fullName: string
  contactType: 'DOCTOR' | 'FAMILY_MEMBER'
  profileId: number
  patientId: number
  patientFullName: string
}

export type FamilyMemberProfile = {
  id: number
  userId: number
  fullName: string
}

export type DoctorPatientAssignment = {
  id: number
  doctorProfileId: number
  patientId: number
  active: boolean
}

export type FamilyPatientLink = {
  id: number
  familyMemberProfileId: number
  patientId: number
  active: boolean
}

export type CommercialLine = 'FAMILY' | 'INSTITUTION'
export type PlanType =
  | 'FREE'
  | 'FAMILY_PREMIUM'
  | 'INSTITUTION_BASIC'
  | 'INSTITUTION_PREMIUM'
export type BillingCycle = 'MONTHLY' | 'ANNUALLY'
export type SubscriptionStatus = 'ACTIVE' | 'CANCELLED' | 'PAST_DUE' | 'TRIALING'

export type Plan = {
  id: number
  commercialLine: CommercialLine
  planType: PlanType
  billingCycle: BillingCycle
  price: number
  currency: string
  displayName: string
  maxPatients: number
}

export type Subscription = {
  id: number
  userId: number
  plan: Plan
  status: SubscriptionStatus
  stripeCustomerId: string
  startedAt: string
  currentPeriodEnd: string
}

export type CreateSubscriptionRequest = {
  userId: number
  commercialLine: CommercialLine
  planType: PlanType
  billingCycle: BillingCycle
}

export type CreateCheckoutSessionRequest = CreateSubscriptionRequest & {
  returnUrl?: string
}

export type CheckoutSessionResponse = {
  checkoutUrl: string
}

export type ConfirmCheckoutSessionRequest = {
  sessionId: string
}

export type InvoiceStatus = 'PENDING' | 'PAID' | 'FAILED'

export type Invoice = {
  id: number
  userId: number
  subscriptionId: number
  amount: number
  currency: string
  status: InvoiceStatus
  issuedAt: string
}

export type AppointmentType = 'MEDICAL' | 'FAMILY_VISIT'
export type AppointmentStatus = 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'

export type Appointment = {
  id: number
  patientId: number
  doctorProfileId?: number | null
  familyMemberProfileId?: number | null
  appointmentType: AppointmentType
  status: AppointmentStatus
  startsAt: string
  endsAt: string
  reason: string
}

export type ScheduleMedicalAppointmentRequest = {
  patientId: number
  doctorProfileId: number
  startsAt: string
  durationInMinutes: number
  reason: string
}

export type DosageUnit = 'MG' | 'ML' | 'TABLET' | 'CAPSULE' | 'DROP' | 'UNIT'
export type AdministrationRoute = 'ORAL' | 'IV' | 'IM' | 'SUBCUTANEOUS' | 'TOPICAL'
export type FrequencyType = 'DAILY' | 'TWICE_DAILY' | 'WEEKLY' | 'AS_NEEDED'
export type DoseAdministrationStatus = 'ADMINISTERED' | 'SKIPPED'

export type Medication = {
  id: number
  patientId: number
  name: string
  dosageAmount: number
  dosageUnit: DosageUnit
  administrationRoute: AdministrationRoute
  stockQuantity: number
  lowStockThreshold: number
  expirationDate: string
  active: boolean
}

export type RegisterMedicationRequest = {
  patientId: number
  name: string
  dosageAmount: number
  dosageUnit: DosageUnit
  administrationRoute: AdministrationRoute
  stockQuantity: number
  lowStockThreshold: number
  expirationDate: string
}

export type UpdateMedicationRequest = Omit<RegisterMedicationRequest, 'patientId'>

export type MedicationSchedule = {
  id: number
  medicationId: number
  patientId: number
  frequencyType: FrequencyType
  timesPerDay: number
  administrationTime: string
  startDate: string
  endDate?: string | null
  active: boolean
}

export type CreateMedicationScheduleRequest = {
  medicationId: number
  patientId: number
  frequencyType: FrequencyType
  timesPerDay: number
  administrationTime: string
  startDate: string
  endDate?: string | null
}

export type DoseAdministration = {
  id: number
  medicationId: number
  scheduleId: number
  patientId: number
  occurredAt: string
  status: DoseAdministrationStatus
  notes: string
}

export type RecordDoseAdministrationRequest = {
  medicationId: number
  scheduleId: number
  patientId: number
  administeredAt: string
  notes: string
}

export type SkipDoseRequest = {
  medicationId: number
  scheduleId: number
  patientId: number
  skippedAt: string
  reason: string
}

export type LowStockAlert = {
  medicationId: number
  patientId: number
  medicationName: string
  currentStock: number
  threshold: number
}

export type UpdateMedicationStockRequest = {
  stockQuantity: number
}

export type EmotionalState = 'CALM' | 'ANXIOUS' | 'SAD' | 'IRRITABLE' | 'CONFUSED' | 'APATHETIC'
export type AlertSeverity = 'MEDIUM' | 'HIGH'
export type AlertStatus = 'ACTIVE' | 'RESOLVED'

export type RecordHealthObservationRequest = {
  recordedByDoctorProfileId: number
  systolicBloodPressure: number
  diastolicBloodPressure: number
  bodyTemperature: number
  painLevel: number
  emotionalState: EmotionalState
  emotionalNotes: string
  clinicalNotes: string
  recordedAt: string
}

export type HealthObservation = RecordHealthObservationRequest & {
  id: number
  patientId: number
}

export type ClinicalAlert = {
  id: number
  patientId: number
  observationId: number
  severity: AlertSeverity
  status: AlertStatus
  message: string
  triggeredAt: string
}

export type HealthSummary = {
  patientId: number
  summary: string
}

export type ReportType = 'VITAL_SIGNS' | 'MEDICATION' | 'FULL_CLINICAL'

export type GenerateReportRequest = {
  patientId: number
  reportType: ReportType
  startDate: string
  endDate: string
}

export type ReportSection = {
  id: number
  title: string
  content: string
  displayOrder: number
}

export type ClinicalReport = {
  id: number
  patientId: number
  reportType: ReportType
  periodStartDate: string
  periodEndDate: string
  generatedAt: string
  summary: string
  pdfPath?: string | null
  sections: ReportSection[]
}

export type MetricType =
  | 'VITAL_SIGN_RECORDS'
  | 'MEDICATION_ADHERENCE'
  | 'APPOINTMENT_COMPLETION'
  | 'CLINICAL_ALERTS'
export type TrendDirection = 'IMPROVING' | 'STABLE' | 'DECLINING'

export type DashboardMetrics = {
  id: number
  patientId: number
  metricSnapshots: {
    id: number
    metricType: MetricType
    value: number
    unit: string
    capturedAt: string
  }[]
  trendIndicators: {
    id: number
    metricType: MetricType
    direction: TrendDirection
    explanation: string
  }[]
}

export type SendChatMessageRequest = {
  recipientUserId: number
  content: string
  sentAt?: string
}

export type ChatMessage = {
  id: string
  chatId: string
  senderUserId: number
  recipientUserId: number
  content: string
  sentAt: string
}

export type ConnectUserRequest = {
  userId: number
  username: string
  fullName: string
}

export type ConnectedUser = {
  id: string
  userId: number
  username: string
  fullName: string
  status: 'ONLINE' | 'OFFLINE'
  connectedAt: string
  disconnectedAt?: string | null
}

export type NotificationStatus = 'UNREAD' | 'READ'
export type NotificationType =
  | 'CRITICAL_ALERT'
  | 'DOSE_ADMINISTERED'
  | 'DOSE_SKIPPED'
  | 'STOCK_LOW'
  | 'SYSTEM'
export type NotificationChannel = 'IN_APP' | 'WEBSOCKET'

export type Notification = {
  id: string
  recipientUserId: number
  patientId?: number | null
  type: NotificationType
  channel: NotificationChannel
  status: NotificationStatus
  title: string
  message: string
  sourceEvent: string
  createdAt: string
  readAt?: string | null
}

export type ApiErrorResponse = {
  timestamp?: string
  status?: number
  error?: string
  message?: string
  path?: string
  details?: string[]
}
