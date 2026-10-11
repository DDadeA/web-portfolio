#version 300 es
precision highp float;

uniform sampler2D highIORSampler;
uniform sampler2D lowIORSampler;
uniform samplerCube backgroundSampler;
uniform sampler2D superficalNormalSampler;

// uniform sampler2D prevFrameSampler;

in vec2 uv;
layout (location = 0) out vec4 fragColor;
layout (location = 1) out vec4 differenceMap;

const float spread = 1.0;
const int iter = 32;

// 1. Non-linear spacing derived from Cauchy's formula (1 / lambda^2)
// High IOR (405nm Violet) -> Low IOR (690nm Red) across 32 sample points
const float dispersionSteps[32] = float[32](
    0.0000, 0.0689, 0.1340, 0.1957, 0.2541, 0.3094, 0.3619, 0.4116,
    0.4588, 0.5036, 0.5462, 0.5866, 0.6250, 0.6616, 0.6963, 0.7294,
    0.7609, 0.7909, 0.8194, 0.8466, 0.8726, 0.8973, 0.9209, 0.9434,
    0.9649, 0.9854, 1.0000, 1.0000, 1.0000, 1.0000, 1.0000, 1.0000
);

// 2. CIE 1931 spectral locus weights mapped to linear sRGB primaries
// Normalized such that sum(R) = 1.00, sum(G) = 1.00, sum(B) = 1.00 (Energy Conserved)
const vec3 spectralWeights[32] = vec3[32](
    vec3(0.0151, 0.0000, 0.0463), // ~405.0 nm
    vec3(0.0128, 0.0000, 0.0622), // ~414.2 nm
    vec3(0.0096, 0.0000, 0.0864), // ~423.4 nm
    vec3(0.0055, 0.0000, 0.1179), // ~432.6 nm
    vec3(0.0016, 0.0028, 0.1418), // ~441.8 nm
    vec3(0.0000, 0.0076, 0.1444), // ~451.0 nm
    vec3(0.0000, 0.0146, 0.1287), // ~460.2 nm
    vec3(0.0000, 0.0246, 0.1030), // ~469.4 nm
    vec3(0.0000, 0.0384, 0.0743), // ~478.5 nm
    vec3(0.0000, 0.0561, 0.0487), // ~487.7 nm
    vec3(0.0000, 0.0763, 0.0284), // ~496.9 nm
    vec3(0.0000, 0.0963, 0.0134), // ~506.1 nm
    vec3(0.0000, 0.1128, 0.0045), // ~515.3 nm
    vec3(0.0009, 0.1226, 0.0000), // ~524.5 nm
    vec3(0.0068, 0.1232, 0.0000), // ~533.7 nm
    vec3(0.0187, 0.1150, 0.0000), // ~542.9 nm
    vec3(0.0360, 0.0999, 0.0000), // ~552.1 nm
    vec3(0.0569, 0.0805, 0.0000), // ~561.3 nm
    vec3(0.0787, 0.0594, 0.0000), // ~570.5 nm
    vec3(0.0988, 0.0395, 0.0000), // ~579.7 nm
    vec3(0.1141, 0.0229, 0.0000), // ~588.9 nm
    vec3(0.1223, 0.0113, 0.0000), // ~598.1 nm
    vec3(0.1222, 0.0048, 0.0000), // ~607.3 nm
    vec3(0.1140, 0.0017, 0.0000), // ~616.5 nm
    vec3(0.0991, 0.0005, 0.0000), // ~625.6 nm
    vec3(0.0801, 0.0001, 0.0000), // ~634.8 nm
    vec3(0.0603, 0.0000, 0.0000), // ~644.0 nm
    vec3(0.0421, 0.0000, 0.0000), // ~653.2 nm
    vec3(0.0274, 0.0000, 0.0000), // ~662.4 nm
    vec3(0.0166, 0.0000, 0.0000), // ~671.6 nm
    vec3(0.0094, 0.0000, 0.0000), // ~680.8 nm
    vec3(0.0050, 0.0000, 0.0000)  // ~690.0 nm
);

vec3 angleToRGB(float angle) {
    // Decode angle into hue
    float hue = mod(angle / 6.28318530718, 1.0); // Normalize angle to [0, 1]
    float saturation = 1.0;
    float value = 1.0;

    // Convert HSV to RGB
    float c = value * saturation;
    float x = c * (1.0 - abs(mod(hue * 6.0, 2.0) - 1.0));
    float m = value - c;

    vec3 rgb;
    if (hue < 1.0 / 6.0) {
        rgb = vec3(c, x, 0.0);
    } else if (hue < 2.0 / 6.0) {
        rgb = vec3(x, c, 0.0);
    } else if (hue < 3.0 / 6.0) {
        rgb = vec3(0.0, c, x);
    } else if (hue < 4.0 / 6.0) {
        rgb = vec3(0.0, x, c);
    } else if (hue < 5.0 / 6.0) {
        rgb = vec3(x, 0.0, c);
    } else {
        rgb = vec3(c, 0.0, x);
    }

    return rgb + m;
}

void main() {
    vec4 bufferA = texture(highIORSampler, uv);
    vec4 bufferB = texture(lowIORSampler, uv);

    vec3 bias = vec3(0.0);
    float variance = 0.0;


    if (bufferA.w == 2.0) {
        // bias = vec3(0.5);
        variance = 6.0;
    }


    vec3 rayHigh = bufferA.xzy;
    vec3 rayLow  = bufferB.xzy;


    // No refraction / air hit
    if (bufferA == bufferB) {
        fragColor = vec4(textureLod(backgroundSampler, bufferA.xzy, 0.0).rgb, 1.0);
        return;
    }


    differenceMap = vec4(rayHigh - rayLow, 1.0);
    // float separation = length(rayHigh - rayLow); // Difference for adaptive sampling (LOD)

    vec3 accumColor = vec3(0.0);
    for (int i = 0; i < iter; i++) {
        float t = dispersionSteps[i] * spread;
        
        // normalize prevents chord-shortening artifact on wide spreads
        vec3 rayDir = normalize(mix(rayHigh, rayLow, t));
        
        // accumColor += textureLod(backgroundSampler, rayDir, separation * 10.0).rgb * spectralWeights[i];
        accumColor += textureLod(backgroundSampler, rayDir, variance).rgb * spectralWeights[i];
    }

    // Add reflection
    vec4 normal = texture(superficalNormalSampler, uv);
    vec3 reflectionColor = texture(backgroundSampler, normal.xyz).rgb;
    float strength = (0.04 + max(0.0, 1.0 + normal.a));

    if (bufferA.w == 2.0 || bufferB.w == 2.0) {
        // strength *= 1.5; // Increase reflection strength for metallic surfaces
    }

    accumColor = (accumColor - bias) * (1.0) + reflectionColor * strength;

    accumColor = clamp(accumColor, 0.0, 1.0);
    
    // Motion blur
    // if(bufferA.w == 2.0 || bufferB.w == 2.0) {
    //     vec3 prevColor = texture(prevFrameSampler, uv).rgb;
    //     float blurFactor = 0.2; // Adjust this value for more or less motion blur
    //     accumColor = mix(accumColor, prevColor, blurFactor);
    // }
    // Cool tone
    accumColor = pow(accumColor, vec3(0.9, 0.95, 1.0));



    fragColor = vec4(accumColor, 1.0);
}