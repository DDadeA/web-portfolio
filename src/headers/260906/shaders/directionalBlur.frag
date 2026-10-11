#version 300 es
precision highp float;

uniform sampler2D highIORSampler;
uniform sampler2D lowIORSampler;
uniform samplerCube backgroundSampler;

in vec2 uv;
layout (location = 0) out vec4 fragColor;
layout (location = 1) out vec4 differenceMap;

const float spread = 1.0;
const int iter = 9;

// 1. Non-linear spacing derived from Cauchy's formula (1 / lambda^2)
// High IOR (405nm Violet) -> Low IOR (690nm Red)
const float dispersionSteps[9] = float[9](
    0.000, // 405 nm (Deep Violet)
    0.233, // 440 nm (Blue)
    0.417, // 475 nm (Cyan-Blue)
    0.563, // 510 nm (Cyan-Green)
    0.683, // 545 nm (Green)
    0.782, // 580 nm (Yellow)
    0.864, // 615 nm (Amber-Orange)
    0.933, // 650 nm (Red)
    1.000  // 690 nm (Deep Red)
);

// 2. CIE 1931 spectral locus weights mapped to sRGB primaries
// Sum of R = 1.00, Sum of G = 1.00, Sum of B = 1.00 (Energy Conserved)
const vec3 spectralWeights[9] = vec3[9](
    vec3(0.04, 0.00, 0.18), // Violet
    vec3(0.01, 0.02, 0.35), // Blue
    vec3(0.00, 0.08, 0.32), // Cyan-Blue
    vec3(0.00, 0.22, 0.13), // Cyan-Green
    vec3(0.08, 0.32, 0.02), // Green
    vec3(0.25, 0.25, 0.00), // Yellow
    vec3(0.32, 0.10, 0.00), // Amber-Orange
    vec3(0.22, 0.01, 0.00), // Red
    vec3(0.08, 0.00, 0.00)  // Deep Red
);

void main() {
    vec4 bufferA = texture(highIORSampler, uv);
    vec4 bufferB = texture(lowIORSampler, uv);

    // Material 3: pass-through / emission
    if (bufferA.w == 3.0) {
        fragColor = vec4(1.0);
        return;
    }

    // No refraction / air hit
    if (bufferA == bufferB) {
        fragColor = vec4(texture(backgroundSampler, bufferA.xzy).rgb, 1.0);
        return;
    }

    vec3 rayHigh = bufferA.xzy;
    vec3 rayLow  = bufferB.xzy;

    differenceMap = vec4(rayHigh - rayLow, 1.0);
    float separation = length(rayHigh - rayLow); // Let's calculate difference for adaptive sampling (LOD)
    
    vec3 accumColor = vec3(0.0);
    for (int i = 0; i < iter; i++) {
        float t = dispersionSteps[i] * spread;
        
        // normalize prevents chord-shortening artifact on wide spreads
        vec3 rayDir = normalize(mix(rayHigh, rayLow, t));
        
        accumColor += textureLod(backgroundSampler, rayDir, separation * 10.0).rgb * spectralWeights[i];
    }

    fragColor = vec4(accumColor * 1.3, 1.0) ;
}