#version 300 es
precision highp float;

// #define IOR 0.7
float IOR = 1.1;


uniform vec3 u_objectRotation;
uniform float u_objectScale;
uniform vec3 u_objectPosition;

uniform float u_aspectRatio;
uniform vec3 u_cameraPos;
uniform float u_fov;
uniform vec3 u_pointing;

uniform float u_time;
uniform float u_eps;

in vec2 uv;

layout (location = 0) out vec4 out_rayDir;
layout (location = 1) out vec4 out_normal;
layout (location = 2) out float out_depth;

vec3 hash33(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.xxy + p.yxx) * p.zyx);
}

vec3 refraction(vec3 ray, vec3 norm, float IOR) {
    float r = 1.0 / IOR;
    norm = normalize(norm);
    ray = normalize(ray);

    float d = dot(norm, ray);
    float k = 1.0 - r*r*(1.0-d*d);

    if (k > 0.0) {
        return r * ray - (r * d + sqrt(k)) * norm;
    }

    return ray - 2.0 * d * norm;
}
float opDisplacement(vec3 rayPos) {
    return sin(rayPos.x * 2.13) * sin(rayPos.y * 4.1) * sin(rayPos.z * 3.1);
}
vec3 opTwist(vec3 p, float k) {
    float c = cos(k*p.y);
    float s = sin(k*p.y);
    return vec3( mat2(c, -s, s, c) * p.xz, p.y);
}

float sdSphere(vec3 rayPos, vec3 spherePos, float r) {
    return length(rayPos - spherePos) - r;
}
float sdBox( vec3 rayPos, vec3 b ) {
    vec3 q = abs(rayPos) - b;
    return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}
float sdCappedCylinder( vec3 p, float r, float h ) {
    vec2 d = abs(vec2(length(p.xy), p.z)) - vec2(r,h);
    return min(max(d.x,d.y),0.0) + length(max(d,0.0));
}
vec3 rotate(vec3 p, vec3 r) {
    vec3 s = sin(r);
    vec3 c = cos(r);
    // vec3 s = vec3(sin(r.x), sin(r.y), sin(r.z));
    // vec3 c = vec3(cos(r.x), cos(r.y), cos(r.z));

    return p * mat3(
        1., 0., 0.,
        0., c.x, -s.x,
        0., s.x, c.x
    ) * mat3(
        c.y, 0., s.y,
        0., 1., 0.,
        -s.y, 0., c.y
    ) * mat3(
        c.z, -s.z, 0.,
        s.z, c.z, 0.,
        0., 0., 1.
    );
}

// float getDist(vec3 rayPos) {
//     vec3 p = rayPos;

    
//     p = rotate(p , u_objectRotation) * u_objectScale + u_objectPosition;

//     // p = opTwist(p, 0.3); // this cannot define negative distance well i guess?

//     return sdBox(p, vec3(3.0)) - 0.2;

//     // return sdCappedCylinder(
//     //     p,
//     //     1.5,
//     //     2.5
//     // ) - 0.2;
// }

float getDist(vec3 rayPos) {
    // 1. Center transformed space
    vec3 p = rayPos;
    p = rotate(p - u_objectPosition, u_objectRotation) / u_objectScale;

    // Main central rounded box
    float d = sdBox(p, vec3(2.0)) - 0.2;

    // 2. Inner sphere core (visible through refractive glass)
    float innerSphere = sdSphere(p, vec3(0.0), 1.2);
    d = min(d, innerSphere);

    // 3. Orbiting satellite spheres
    float t = u_time * 0.8;
    vec3 s1_pos = vec3(sin(t) * 4.5, cos(t) * 4.5, sin(t * 1.5) * 1.5);
    vec3 s2_pos = vec3(sin(t + 2.094) * 4.5, cos(t + 2.094) * 4.5, cos(t * 1.5) * 1.5);
    vec3 s3_pos = vec3(sin(t + 4.188) * 4.5, cos(t + 4.188) * 4.5, -sin(t * 1.5) * 1.5);

    d = min(d, sdSphere(p, s1_pos, 0.6));
    d = min(d, sdSphere(p, s2_pos, 0.5));
    d = min(d, sdSphere(p, s3_pos, 0.7));

    // 4. Floating geometric pillars / bars
    vec3 pCyl1 = rotate(p - vec3(0.0, 0.0, 3.8), vec3(0.0, 1.5708, t * 0.5));
    float topCyl = sdCappedCylinder(pCyl1, 0.3, 2.5) - 0.1;
    d = min(d, topCyl);

    vec3 pCyl2 = rotate(p - vec3(0.0, 0.0, -3.8), vec3(1.5708, 0.0, -t * 0.5));
    float botCyl = sdCappedCylinder(pCyl2, 0.3, 2.5) - 0.1;
    d = min(d, botCyl);

    // 5. Small tumbling satellite cubes
    vec3 pBox1 = rotate(p - vec3(sin(t * 1.2) * 5.5, 0.0, cos(t * 1.2) * 3.0), vec3(t, t * 0.5, 0.0));
    float satBox = sdBox(pBox1, vec3(0.5)) - 0.1;
    d = min(d, satBox);

    // Reapply scale correctly to preserve true distance metric
    return d * u_objectScale;
}

vec3 getNormal(vec3 rayPos) {
    const vec2 k = vec2(1, -1);

    vec3 norm = k.xyy * getDist(rayPos + k.xyy*u_eps) +
                k.yxy * getDist(rayPos + k.yxy*u_eps) +
                k.xxx * getDist(rayPos + k.xxx*u_eps) +
                k.yyx * getDist(rayPos + k.yyx*u_eps);
                
    return normalize(norm);
}

void main() {
    vec3 reference = normalize(u_pointing - u_cameraPos);

    vec3 horizontal = cross(reference, vec3(0.0, 0.0, 1.0)); // z vector is up
    vec3 vertical = cross(horizontal, reference);

    horizontal = normalize(horizontal) * tan(radians(u_fov) / 2.0);
    vertical = normalize(vertical) * tan(radians(u_fov) / 2.0) / u_aspectRatio;

    vec3 cameraRay = normalize(reference + (uv.x - 0.5) * 2.0 * horizontal + (uv.y - 0.5) * 2.0 * vertical);

    vec3 rayPos = u_cameraPos;
    vec3 rayDir = cameraRay;
    float totalDistance = 0.0;

    out_normal = vec4(0.0);
    out_depth  = 1000.0;


    for (int i = 0; i < 512; i++) {
        float distance = getDist(rayPos);
        float absDistance = abs(distance);

        totalDistance += absDistance;

        // Hits the face
        if (abs(distance) < .001) {
            vec3 normal = getNormal(rayPos);

            
            if (out_normal.a == 0.0) {  // Only for the first hit
                out_depth = totalDistance; 
                out_normal = vec4(normal, 1.0);
            }

            // rayPos += rayDir * (1.0 / dot(rayDir, -normal));

            if (dot(rayDir, normal) < 0.0) {
                rayDir = refraction(rayDir, normal, IOR);
            } else {
                rayDir = refraction(rayDir, normal * -1.0, 1.0/IOR);
            }

            rayPos += rayDir * .02; // Naive Helper
            


        } else {
            rayPos += rayDir * absDistance;
        }


        if (totalDistance > 1000.0) {
            break;
        }
    }

    out_rayDir = vec4(rayDir, 1.0);
}