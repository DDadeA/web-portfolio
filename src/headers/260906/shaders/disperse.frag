#version 300 es
precision highp float;

uniform sampler2D highIORSampler;
uniform sampler2D lowIORSampler;
uniform samplerCube backgroundSampler; // Cubemap

in vec2 uv;
out vec4 fragColor;


// float spread = 0.2;
float spread = 1.0;
int iter = 9;

vec4 distribution[9] = vec4[9](
    vec4(.02, .03, .30, 1.0),
    vec4(.03, .07, .17, 1.0),
    vec4(.05, .10, .13, 1.0),
    vec4(.07, .15, .12, 1.0),
    vec4(.11, .30, .11, 1.0),
    vec4(.12, .15, .07, 1.0),
    vec4(.13, .10, .05, 1.0),
    vec4(.17, .07, .03, 1.0),
    vec4(.30, .03, .02, 1.0)
);

void main(){
    vec4 bufferA = texture(highIORSampler, uv);
    vec4 bufferB = texture(lowIORSampler, uv);
    
    // fragColor = vec4(uv, 0.0, 1.0);
    // fragColor = texture(backgroundSampler, bufferA.xzy);

    // material 3: shade
    if (bufferA.w == 3.0) {
        fragColor = vec4(1.0, 1.0, 1.0, 1.0);
        return;
    }


    if (bufferA == bufferB) {
        fragColor = texture(backgroundSampler, bufferA.xzy);
        return;
    }

    
    // Handle the glass
    for (int i = 0; i < iter; i++){
        vec3 uv = 
            + bufferA.xzy * (1.0 - spread * float(i) / float(iter))
            + bufferB.xzy * (spread * float(i)/float(iter));
        fragColor += texture(backgroundSampler, uv) * distribution[i];
    }
    
    fragColor *= 1.3;
}