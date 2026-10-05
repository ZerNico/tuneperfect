{{/*
Common labels
*/}}
{{- define "tuneperfect.labels" -}}
helm.sh/chart: {{ include "tuneperfect.chart" . }}
{{ include "tuneperfect.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{/*
Selector labels
*/}}
{{- define "tuneperfect.selectorLabels" -}}
app.kubernetes.io/name: {{ include "tuneperfect.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "tuneperfect.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Common name
*/}}
{{- define "tuneperfect.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "tuneperfect.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{/*
Create the name of the service account to use
*/}}
{{- define "tuneperfect.serviceAccountName" -}}
{{- if .Values.global.serviceAccount.create -}}
    {{ default (include "tuneperfect.fullname" .) .Values.global.serviceAccount.name }}
{{- else -}}
    {{ default "default" .Values.global.serviceAccount.name }}
{{- end -}}
{{- end -}}

{{/*
Return the appropriate apiVersion for deployment.
*/}}
{{- define "tuneperfect.deployment.apiVersion" -}}
{{- if semverCompare ">=1.9-0" .Capabilities.KubeVersion.GitVersion -}}
{{- print "apps/v1" -}}
{{- else -}}
{{- print "extensions/v1beta1" -}}
{{- end -}}
{{- end -}} 
{{/*
Name of the Secret holding coturn's static-auth-secret, shared with the API.
*/}}
{{- define "tuneperfect.coturn.secretName" -}}
coturn-credentials
{{- end -}}

{{/*
coturn's static-auth-secret: TURN credentials are signed with it (see apps/api/src/webrtc/service.ts).
Generated on first install and read back from the cluster on upgrades, so it only changes when the
Secret is deleted (rotation) or coturn.authSecret is set. Memoized in .Values because every include
would otherwise roll a different random value within one render. `lookup` finds nothing under
`helm template` and client-side `--dry-run`, so those render a throwaway value.
*/}}
{{- define "tuneperfect.coturn.authSecret" -}}
{{- if not (hasKey .Values.coturn "_authSecret") -}}
{{- $existing := "" -}}
{{- $found := lookup "v1" "Secret" .Release.Namespace (include "tuneperfect.coturn.secretName" .) -}}
{{- if $found -}}
{{- $existing = index ($found.data | default dict) "TURN_SECRET" | default "" | b64dec -}}
{{- end -}}
{{- $_ := set .Values.coturn "_authSecret" (.Values.coturn.authSecret | default $existing | default (randAlphaNum 64)) -}}
{{- end -}}
{{- index .Values.coturn "_authSecret" -}}
{{- end -}}

{{/*
The TURN server once per transport (e.g. UDP and TCP), comma-separated for the API's TURN_URLS.
*/}}
{{- define "tuneperfect.coturn.turnUrls" -}}
{{- $urls := list -}}
{{- range .Values.coturn.transports -}}
{{- $urls = append $urls (printf "turn:%s:%d?transport=%s" $.Values.coturn.host (int $.Values.coturn.listeningPort) .) -}}
{{- end -}}
{{- join "," $urls -}}
{{- end -}}
