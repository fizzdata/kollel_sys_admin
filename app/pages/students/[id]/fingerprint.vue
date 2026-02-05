<script setup lang="ts">
definePageMeta({
  layout: "sidebar",
  middleware: ["auth"],
});

import { ref } from 'vue';
import { useRoute } from '#imports';

const route = useRoute();
const studentId = String(route.params.id || '');
const toast = useToast();
const api = useApi();

const fingerprintStatus = ref<'idle' | 'scanning' | 'success' | 'error'>('idle');
const quality = ref<number>(80);
const isSubmitting = ref(false);

const secugen_lic = 'wWhR7Whak8enCcEfPCEjEiSgbEotPRLf7PBM4jHXKVc=';

const f1_template = ref<string>('');
const f2_template = ref<string>('');
const f3_template = ref<string>('');

const f1_score = ref<string>('');
const f2_score = ref<string>('');
const f3_score = ref<string>('');

const f1_img = ref<string>('');
const f2_img = ref<string>('');
const f3_img = ref<string>('');

function msg(type: 'error' | 'success' | 'info', text: string) {
  console[type === 'error' ? 'error' : 'log'](text);
  toast.add({
    title: type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Info',
    description: text,
    color: type === 'success' ? 'success' : type === 'error' ? 'error' : 'info',
    duration: type === 'error' ? 5000 : 3000,
  });
}

function ErrorCodeToString(ErrorCode: number) {
  switch (ErrorCode) {
    case 51: return 'System file load failure';
    case 52: return 'Sensor chip initialization failed';
    case 53: return 'Device not found';
    case 54: return 'Fingerprint image capture timeout';
    case 55: return 'No device available';
    case 56: return 'Driver load failed';
    case 57: return 'Wrong Image';
    case 58: return 'Lack of bandwidth';
    case 59: return 'Device Busy';
    case 60: return "Cannot get serial number of the device";
    case 61: return 'Unsupported device';
    case 63: return "SgiBioSrv didn't start; Try image capture again";
    default: return 'Unknown error code or Update code to reflect latest result';
  }
}

async function callSGIFPCapture(): Promise<any> {
  const uri = 'https://localhost:8443/SGIFPCapture';
  const params = new URLSearchParams();
  params.append('Timeout', '10000');
  params.append('Quality', String(quality.value));
 // params.append('licstr', secugen_lic);
  params.append('templateFormat', 'ISO');

  const res = await fetch(uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) throw new Error('SGIFPCapture error: ' + res.status);
  return res.json();
}

async function getMatchScore(template2: string): Promise<number> {
  const uri = 'https://localhost:8443/SGIMatchScore';
  const params = new URLSearchParams();
  params.append('template1', f1_template.value);
  params.append('template2', template2);
  //params.append('licstr', secugen_lic);
  params.append('templateFormat', 'ISO');

  const res = await fetch(uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) throw new Error('SGIMatchScore error: ' + res.status);
  const result = await res.json();
  if (result.ErrorCode && result.ErrorCode !== 0) {
    throw new Error('Match error: ' + result.ErrorCode);
  }
  return Number(result.MatchingScore || 0);
}

async function captureFinger(slot: 1 | 2 | 3) {
  fingerprintStatus.value = 'scanning';
  try {
    const result = await callSGIFPCapture();
    if (result && result.ErrorCode === 0 && result.TemplateBase64 && result.TemplateBase64.length > 0) {
      const bmp = result.BMPBase64 || '';
      const tmpl = result.TemplateBase64 || '';
      const score = result.ImageQuality || '';

      if (slot === 1) {
        f1_img.value = bmp ? 'data:image/bmp;base64,' + bmp : '';
        f1_template.value = tmpl;
        f1_score.value = String(score);
        msg('info', 'First capture successful');
      } else {
        if (!f1_template.value) {
          msg('error', 'Please capture the first fingerprint before matching.');
          fingerprintStatus.value = 'error';
          return;
        }

        const match = await getMatchScore(tmpl);
        const threshold = Number(quality.value || 100);
        if (match < threshold) {
          msg('error', `Its not the same finger (score ${match})`);
          fingerprintStatus.value = 'error';
          return;
        }

        if (slot === 2) {
          f2_img.value = bmp ? 'data:image/bmp;base64,' + bmp : '';
          f2_template.value = tmpl;
          f2_score.value = String(score);
          msg('info', 'Second capture matched');
        } else {
          f3_img.value = bmp ? 'data:image/bmp;base64,' + bmp : '';
          f3_template.value = tmpl;
          f3_score.value = String(score);
          msg('info', 'Third capture matched');
        }
      }

      fingerprintStatus.value = 'success';
    } else {
      fingerprintStatus.value = 'error';
      const code = result ? result.ErrorCode : 'unknown';
      msg('error', 'Fingerprint Capture Error Code: ' + code + '. Description: ' + ErrorCodeToString(code));
    }
  } catch (err: any) {
    fingerprintStatus.value = 'error';
    msg('error', 'Capture failed: ' + (err?.message || err));
  }
}

async function submit() {
  if (!f1_template.value) {
    msg('error', 'Capture at least the first fingerprint before submitting.');
    return;
  }

  isSubmitting.value = true;
  const payload = {
    student_id: studentId,
    f1_template: f1_template.value,
    f1_score: f1_score.value,
    f2_template: f2_template.value,
    f2_score: f2_score.value,
    f3_template: f3_template.value,
    f3_score: f3_score.value,
  };

  try {
    const response = await api(`/api/students/${studentId}/fingerprint`, {
      method: 'POST',
      body: payload,
    });
    
    if (response?.success) {
      msg('success', response.message || 'Fingerprint submitted successfully');
      // Clear the captured data after successful submission
      f1_template.value = '';
      f2_template.value = '';
      f3_template.value = '';
      f1_score.value = '';
      f2_score.value = '';
      f3_score.value = '';
      f1_img.value = '';
      f2_img.value = '';
      f3_img.value = '';
      fingerprintStatus.value = 'idle';
    } else {
      msg('error', response?.message || 'Fingerprint submission failed');
    }
  } catch (err: any) {
    msg('error', 'Submit failed: ' + (err?.message || err));
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-start w-full md:w-fit">
      <UButton
        variant="outline"
        color="primary"
        :to="`/students/${studentId}`"
        icon="i-lucide-arrow-left"
        class="w-fit"
        label="Back to Student Detail Page"
      />
    </div>

    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Register Fingerprint</h1>
        <p class="text-sm text-gray-500">Register a fingerprint for a student (Admin only)</p>
      </div>
    </div>

    <UCard class="rounded-2xl shadow-sm">
      <template #header>
        <h2 class="font-semibold">Fingerprint Registration</h2>
      </template>

      <div class="space-y-6">
        <!-- Quality Control -->
        <div class="space-y-4">
          <UFormGroup label="Quality Threshold" description="Adjust the minimum quality required for fingerprint matching">
            <div class="space-y-3">
              <div class="flex items-center justify-between text-sm text-gray-600">
                <span>Lower Quality (50%)</span>
                <span>Higher Quality (100%)</span>
              </div>
              <div class="flex items-center gap-4">
                <UInput
                  v-model="quality"
                  type="range"
                  :min="50"
                  :max="100"
                  :step="1"
                  class="flex-1"
                />
                <div class="flex items-center gap-2">
                  <UBadge variant="soft" color="primary" size="lg">
                    {{ quality }}%
                  </UBadge>
                  <UButton
                    variant="ghost"
                    size="sm"
                    icon="i-lucide-refresh-cw"
                    @click="quality = 80"
                    title="Reset to default (80%)"
                  />
                </div>
              </div>
              <div class="flex justify-between text-xs text-gray-500">
                <span>More lenient matching</span>
                <span>Stricter matching</span>
              </div>
            </div>
          </UFormGroup>
        </div>

        <!-- Fingerprint Capture Grid -->
        <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
          <!-- First Capture -->
          <div class="space-y-4">
            <div class="text-center">
              <h3 class="font-medium text-gray-900">Step 1</h3>
              <p class="text-sm text-gray-500">Initial capture</p>
            </div>
            <UButton 
              :loading="fingerprintStatus === 'scanning'"
              :disabled="fingerprintStatus === 'scanning'"
              block
              color="primary"
              size="lg"
              icon="i-lucide-fingerprint"
              @click="captureFinger(1)"
            >
              Place Finger
            </UButton>
            <div v-if="f1_img" class="relative">
              <img 
                :src="f1_img" 
                alt="Fingerprint 1"
                class="w-full h-32 object-contain bg-gray-50 rounded-lg border"
              />
              <UBadge 
                v-if="f1_score" 
                class="absolute top-2 right-2" 
                variant="soft" 
                color="success"
              >
                Score: {{ f1_score }}
              </UBadge>
            </div>
          </div>

          <!-- Second Capture -->
          <div class="space-y-4">
            <div class="text-center">
              <h3 class="font-medium text-gray-900">Step 2</h3>
              <p class="text-sm text-gray-500">Verification capture</p>
            </div>
            <UButton 
              :loading="fingerprintStatus === 'scanning'"
              :disabled="fingerprintStatus === 'scanning' || !f1_template"
              block
              color="primary"
              size="lg"
              icon="i-lucide-fingerprint"
              @click="captureFinger(2)"
            >
              Place Same Finger
            </UButton>
            <div v-if="f2_img" class="relative">
              <img 
                :src="f2_img" 
                alt="Fingerprint 2"
                class="w-full h-32 object-contain bg-gray-50 rounded-lg border"
              />
              <UBadge 
                v-if="f2_score" 
                class="absolute top-2 right-2" 
                variant="soft" 
                color="success"
              >
                Score: {{ f2_score }}
              </UBadge>
            </div>
          </div>

          <!-- Third Capture -->
          <div class="space-y-4">
            <div class="text-center">
              <h3 class="font-medium text-gray-900">Step 3</h3>
              <p class="text-sm text-gray-500">Final verification</p>
            </div>
            <UButton 
              :loading="fingerprintStatus === 'scanning'"
              :disabled="fingerprintStatus === 'scanning' || !f1_template"
              block
              color="primary"
              size="lg"
              icon="i-lucide-fingerprint"
              @click="captureFinger(3)"
            >
              Place Same Finger
            </UButton>
            <div v-if="f3_img" class="relative">
              <img 
                :src="f3_img" 
                alt="Fingerprint 3"
                class="w-full h-32 object-contain bg-gray-50 rounded-lg border"
              />
              <UBadge 
                v-if="f3_score" 
                class="absolute top-2 right-2" 
                variant="soft" 
                color="success"
              >
                Score: {{ f3_score }}
              </UBadge>
            </div>
          </div>
        </div>

        <!-- Status Display -->
        <div v-if="fingerprintStatus !== 'idle'" class="flex justify-center">
          <UAlert
            :color="fingerprintStatus === 'success' ? 'success' : fingerprintStatus === 'error' ? 'error' : 'info'"
            :variant="fingerprintStatus === 'success' ? 'soft' : 'outline'"
            :title="fingerprintStatus === 'scanning' ? 'Scanning...' : fingerprintStatus === 'success' ? 'Capture Successful' : 'Capture Failed'"
            :description="fingerprintStatus === 'scanning' ? 'Please wait while we capture your fingerprint' : ''"
          />
        </div>

        <!-- Submit Button -->
        <div class="pt-4 border-t">
          <UButton 
            :loading="isSubmitting"
            :disabled="!f1_template || isSubmitting"
            block
            size="lg"
            color="success"
            icon="i-lucide-check"
            @click="submit"
          >
            {{ isSubmitting ? 'Submitting...' : 'Submit Fingerprint Registration' }}
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
