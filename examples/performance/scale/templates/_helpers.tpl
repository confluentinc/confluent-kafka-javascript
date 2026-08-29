{{- define "ckjs-perf-scale.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 53 | trimSuffix "-" -}}
{{- end -}}

{{- define "ckjs-perf-scale.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 53 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 53 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 53 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "ckjs-perf-scale.labels" -}}
app.kubernetes.io/name: {{ include "ckjs-perf-scale.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
{{- end -}}

{{- define "ckjs-perf-scale.configMapName" -}}
{{ include "ckjs-perf-scale.fullname" . }}-env
{{- end -}}

{{- define "ckjs-perf-scale.consumerConfigMapName" -}}
{{ include "ckjs-perf-scale.fullname" . }}-consumer-env
{{- end -}}

{{- define "ckjs-perf-scale.producerConfigMapName" -}}
{{ include "ckjs-perf-scale.fullname" . }}-producer-config
{{- end -}}

{{- define "ckjs-perf-scale.consumerExtraConfigMapName" -}}
{{ include "ckjs-perf-scale.fullname" . }}-consumer-config
{{- end -}}

{{- define "ckjs-perf-scale.secretName" -}}
{{ include "ckjs-perf-scale.fullname" . }}-sasl
{{- end -}}

{{- define "ckjs-perf-scale.producerJobName" -}}
{{ include "ckjs-perf-scale.fullname" . }}-producer
{{- end -}}

{{- define "ckjs-perf-scale.consumerJobName" -}}
{{ include "ckjs-perf-scale.fullname" . }}-consumer
{{- end -}}

{{- define "ckjs-perf-scale.createTopicsJobName" -}}
{{ include "ckjs-perf-scale.fullname" . }}-create-topics
{{- end -}}

{{/*
Node affinity pinning pods to nodes whose kubernetes.io/arch matches
.Values.nodeArch. Emits nothing when nodeArch is empty. Include at the pod
spec level, e.g. `{{- include "ckjs-perf-scale.nodeArchAffinity" . | nindent 6 }}`.
*/}}
{{- define "ckjs-perf-scale.nodeArchAffinity" -}}
affinity:
  nodeAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      nodeSelectorTerms:
        - matchExpressions:
            - key: kubernetes.io/arch
              operator: In
              values:
                - {{ .Values.nodeArch | quote }}
{{- end -}}
