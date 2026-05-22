import { SelectedView, CameraAnglePreset, LensFocusPreset, ShotSizePreset } from '../types';

// Convention: yaw describes which side of the SUBJECT is visible to the camera.
// yaw = 0 -> subject faces camera (front view).
// Positive yaw rotates the subject clockwise (viewed from above),
// progressively exposing the subject's RIGHT side, then back, then LEFT side.
export const getYawLabel = (yaw: number): string => {
    const norm = ((Math.round(yaw) % 360) + 360) % 360;
    if (norm < 11.25 || norm >= 348.75) return 'front view';
    if (norm < 33.75)  return 'near-frontal right view';
    if (norm < 56.25)  return 'three-quarter right view';
    if (norm < 78.75)  return 'near-profile right view';
    if (norm < 101.25) return 'right side view (full right profile)';
    if (norm < 123.75) return 'rear-oblique right view';
    if (norm < 146.25) return 'three-quarter back right view';
    if (norm < 168.75) return 'near-rear right view';
    if (norm < 191.25) return 'back view';
    if (norm < 213.75) return 'near-rear left view';
    if (norm < 236.25) return 'three-quarter back left view';
    if (norm < 258.75) return 'rear-oblique left view';
    if (norm < 281.25) return 'left side view (full left profile)';
    if (norm < 303.75) return 'near-profile left view';
    if (norm < 326.25) return 'three-quarter left view';
    return 'near-frontal left view';
};

// Convention: negative pitch = camera above subject (tilted down).
// positive pitch = camera below subject (tilted up).
// Symmetric thresholds so |pitch|=N maps to mirrored-intensity labels.
export const getPitchLabel = (pitch: number): string => {
    const p = Math.round(pitch);
    if (p <= -75) return 'overhead shot (camera directly above subject, looking straight down)';
    if (p <= -52) return "bird's-eye view";
    if (p <= -37) return 'top-down angle';
    if (p <= -22) return 'high angle';
    if (p <= -7)  return 'slight high angle';
    if (p >= 75)  return 'vertical up shot (camera directly below subject, looking straight up)';
    if (p >= 52)  return "worm's-eye view";
    if (p >= 37)  return 'extreme low angle';
    if (p >= 22)  return 'low angle';
    if (p >= 7)   return 'slight low angle';
    return 'eye-level shot';
};

export const getFovLensLabel = (fov: number): string => {
    if (fov < 50)   return `telephoto lens (${fov}° FOV)`;
    if (fov <= 90)  return `standard lens (${fov}° FOV)`;
    if (fov <= 150) return `ultra-wide lens (${fov}° FOV)`;
    return `fisheye lens (${fov}° FOV)`;
};

export const getFocalLengthLabel = (mm: number): string => {
    if (mm < 24)  return `extreme wide-angle focal length (${mm}mm)`;
    if (mm < 35)  return `wide-angle focal length (${mm}mm)`;
    if (mm < 70)  return `standard focal length (${mm}mm)`;
    if (mm < 135) return `short telephoto focal length (${mm}mm)`;
    return `telephoto focal length (${mm}mm)`;
};

export const SHOT_SIZE_LABELS: Record<ShotSizePreset, string> = {
    extremeLongShot: 'extreme long shot — full environment, character very small',
    longShot:        'long shot — full body with significant surrounding space',
    fullShot:        'full shot — complete head-to-toe framing',
    kneeShot:        'knee shot — framed from knees up',
    waistShot:       'waist shot — framed from waist up',
    bustShot:        'bust shot — framed from chest up',
    closeUp:         'close-up — face and shoulders only',
    extremeCloseUp:  'extreme close-up — face detail only',
};

export const CAMERA_ANGLE_LABELS: Record<CameraAnglePreset, string> = {
    eyeLevel:        'eye-level — neutral, straight-on perspective',
    highAngle:       'high angle — camera above, looking down',
    lowAngle:        'low angle — camera below, looking up (heroic/imposing)',
    birdsEye:        "bird's-eye view — directly overhead, top-down",
    wormsEye:        "worm's-eye view — directly below, looking straight up",
    dutchAngle:      'Dutch angle — camera tilted on roll axis for tension/unease',
    overTheShoulder: 'over-the-shoulder composition — framing subject from behind another character',
};

export const LENS_FOCUS_LABELS: Record<LensFocusPreset, string> = {
    deepFocus:     'deep focus — sharp from foreground to background',
    shallowFocus:  'shallow depth of field — subject sharp, background softly blurred',
    rackFocus:     'rack focus — selective focus plane on subject',
    fisheyeLens:   'fisheye lens — extreme wide angle with strong barrel distortion',
    telephotoLens: 'telephoto lens — compressed perspective, isolated subject',
    wideAngleLens: 'wide-angle lens — expanded field of view, dramatic perspective',
};

const YAW_REFERENCE_CLAUSE =
    '(Yaw labels describe which side of the SUBJECT is visible to the camera: ' +
    '"right side view" = the subject\'s right side faces the camera (full right profile shown). ' +
    '"left side view" = the subject\'s left side faces the camera. ' +
    '"back view" = the subject\'s back faces the camera.)';

const PITCH_OVERLAP_PRESETS = new Set<CameraAnglePreset>([
    'eyeLevel', 'highAngle', 'lowAngle', 'birdsEye', 'wormsEye',
]);

export const isPitchOverlapPreset = (preset: CameraAnglePreset | null | undefined): boolean =>
    !!preset && PITCH_OVERLAP_PRESETS.has(preset);

export interface CameraPromptOptions {
    subjectLabel?: string;
    formatStyle?: 'sentence' | 'markdown' | 'comma';
}

export const buildCameraPrompt = (
    cameraView: SelectedView,
    opts: CameraPromptOptions = {}
): string => {
    const { subjectLabel = 'the subject', formatStyle = 'sentence' } = opts;
    const skipDefaults = formatStyle === 'comma';

    type Segment = { text: string };
    const segments: Segment[] = [];

    const norm = ((Math.round(cameraView.yaw) % 360) + 360) % 360;
    const isDefaultYaw   = norm < 11.25 || norm >= 348.75;
    const roundedPitch   = Math.round(cameraView.pitch);
    const isDefaultPitch = roundedPitch >= -7 && roundedPitch <= 7;
    const isPitchPreset  = isPitchOverlapPreset(cameraView.cameraAnglePreset);

    // 1. Position (yaw + pitch) — pitch-overlap preset replaces pitch label
    if (!skipDefaults || !(isDefaultYaw && isDefaultPitch) || cameraView.cameraAnglePreset) {
        if (formatStyle === 'comma') {
            const parts: string[] = [];
            if (isPitchPreset) {
                parts.push(CAMERA_ANGLE_LABELS[cameraView.cameraAnglePreset!].split(' — ')[0]);
            } else if (!isDefaultPitch) {
                parts.push(getPitchLabel(cameraView.pitch).split(' (')[0]);
            }
            if (!isDefaultYaw) parts.push(getYawLabel(cameraView.yaw));
            if (parts.length > 0) segments.push({ text: parts.join(', ') });
        } else {
            const pitchText = isPitchPreset
                ? CAMERA_ANGLE_LABELS[cameraView.cameraAnglePreset!]
                : getPitchLabel(cameraView.pitch);
            segments.push({ text: `Camera angle: ${pitchText}, ${getYawLabel(cameraView.yaw)}` });
        }
    }

    // 2. Non-pitch anglePreset (Dutch/OTS) — stacks with yaw/pitch
    if (cameraView.cameraAnglePreset && !isPitchPreset) {
        const label = CAMERA_ANGLE_LABELS[cameraView.cameraAnglePreset];
        segments.push({
            text: formatStyle === 'comma'
                ? label.split(' — ')[0]
                : `Camera technique: ${label}`,
        });
    }

    // 3. Lens — lensPreset takes priority over fov + focalLength
    if (cameraView.lensFocusPreset) {
        const label = LENS_FOCUS_LABELS[cameraView.lensFocusPreset];
        segments.push({
            text: formatStyle === 'comma'
                ? label.split(' — ')[0]
                : `Lens: ${label}`,
        });
    } else {
        const lensParts: string[] = [];
        if (cameraView.fov !== 50) {
            const fovLabel = getFovLensLabel(cameraView.fov);
            lensParts.push(formatStyle === 'comma' ? fovLabel.replace(/\s*\(\d+° FOV\)$/, '') : fovLabel);
        }
        if (cameraView.focalLength !== 50) {
            lensParts.push(getFocalLengthLabel(cameraView.focalLength));
        }
        if (lensParts.length > 0) {
            segments.push({
                text: formatStyle === 'comma'
                    ? lensParts.join(', ')
                    : `Lens: ${lensParts.join(', ')}`,
            });
        }
    }

    // 4. Shot framing — shotSizePreset (fov handled under lens when no preset)
    if (cameraView.shotSizePreset) {
        const label = SHOT_SIZE_LABELS[cameraView.shotSizePreset];
        segments.push({
            text: formatStyle === 'comma'
                ? label.split(' — ')[0]
                : `Shot framing: ${label}`,
        });
    }

    if (segments.length === 0) return '';

    if (formatStyle === 'markdown') {
        return [
            '**Camera Composition:**',
            ...segments.map(s => `- ${s.text}`),
            `_${YAW_REFERENCE_CLAUSE}_`,
        ].join('\n');
    }
    if (formatStyle === 'comma') {
        return `Camera composition: ${segments.map(s => s.text).join(', ')}`;
    }
    return (
        `Camera composition for ${subjectLabel}: ${segments.map(s => s.text).join('. ')}. ${YAW_REFERENCE_CLAUSE}`
    );
};
