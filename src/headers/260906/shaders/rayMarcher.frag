#version 300 es
precision highp float;

uniform sampler2D u_normalMapSampler;
uniform sampler2D u_roughNormalMapSampler;

uniform vec3 u_objectRotation;
uniform float u_objectScale;
uniform vec3 u_objectPosition;

uniform float u_aspectRatio;
uniform vec3 u_cameraPos;
uniform float u_fov;
uniform vec3 u_pointing;

uniform float u_time;
uniform int u_touchCount;

uniform float u_IOR;
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
    return sin(rayPos.x * 2.13) * sin(rayPos.y * 4.1) * sin(rayPos.z * 3.1) + 1.1;
}
vec3 opTwist(vec3 p, float k) {
    float c = cos(k*p.y);
    float s = sin(k*p.y);
    return vec3( mat2(c, -s, s, c) * p.xz, p.y);
}
// float opRevolution( in vec3 p, in sdf2d primitive, in float o )
// {
//   vec2 q = vec2( length(p.xz) - o, p.y );
//   return primitive(q)
// }
float sdBoxFrame( vec3 p, vec3 b, float e ) {
    p = abs(p  )-b;
  vec3 q = abs(p+e)-e;
  return min(min(
    length(max(vec3(p.x,q.y,q.z),0.0))+min(max(p.x,max(q.y,q.z)),0.0),
    length(max(vec3(q.x,p.y,q.z),0.0))+min(max(q.x,max(p.y,q.z)),0.0)),
    length(max(vec3(q.x,q.y,p.z),0.0))+min(max(q.x,max(q.y,p.z)),0.0));
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
float sdLink( vec3 p, float le, float r1, float r2 )
{
  vec3 q = vec3( p.x, max(abs(p.y)-le,0.0), p.z );
  return length(vec2(length(q.xy)-r1,q.z)) - r2;
}
float sdHexPrism( vec3 p, vec2 h )
{
  const vec3 k = vec3(-0.8660254, 0.5, 0.57735);
  p = abs(p);
  p.xy -= 2.0*min(dot(k.xy, p.xy), 0.0)*k.xy;
  vec2 d = vec2(
       length(p.xy-vec2(clamp(p.x,-k.z*h.x,k.z*h.x), h.x))*sign(p.y-h.x),
       p.z-h.y );
  return min(max(d.x,d.y),0.0) + length(max(d,0.0));
}
float sdTorus( vec3 p, vec2 t ) {
  vec2 q = vec2(length(p.xz)-t.x,p.y);
  return length(q)-t.y;
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

float object1(vec3 p) {
    return sdBox(p, vec3(1.5, 1.5, 1.5)) - 0.25;
}

float object2(vec3 p) {
    vec3 q = rotate(p, vec3(90.0));
    return sdCappedCylinder(q, 2.3, 0.25) - 0.25;
}

float object3(vec3 p) {
    return sdBoxFrame(p, vec3(1.2, 1.8, 1.5), 0.25) - 0.10;
}
float object4(vec3 p) {
    return sdLink(p, 1.0, 1.0, 0.75);
}

float sdCircle( vec2 p, float r ) {
    return length(p) - r;
}

# define N 7
# define scaler 10.0
const vec2[N] polygonVertices = vec2[N](
    vec2(.5, .5) * scaler,
    vec2(0.3, .7) * scaler,
    vec2(.4, .7) * scaler,
    vec2(.4, 1.0) * scaler,
    vec2(.6, 1.0) * scaler,
    vec2(.6, .7) * scaler,
    vec2(0.7, .7) * scaler
);

float sdPolygon(vec2[N] v, vec2 p ) {
    float d = dot(p-v[0],p-v[0]);
    float s = 1.0;
    for( int i=0, j = N - 1; i<N; j=i, i++ )
    {
        vec2 e = v[j] - v[i];
        vec2 w =    p - v[i];
        vec2 b = w - e*clamp( dot(w,e)/dot(e,e), 0.0, 1.0 );
        d = min( d, dot(b,b) );
        bvec3 c = bvec3(p.y>=v[i].y,p.y<v[j].y,e.x*w.y>e.y*w.x);
        if( all(c) || all(not(c)) ) s*=-1.0;  
    }
    return s*sqrt(d);
}

float object5(vec3 p) {
    p = rotate(p, vec3(1.0, 0.7, 0.7));

    // rotation
    // vec2 q = vec2( length(p.xy), p.z );    
    // q += 0.5;
    // float sdfValue = sdPolygon(polygonVertices, q);
    // return sdfValue - 0.05;

    // extrusion
    float h = 0.4; // height of the extrusion
    float d = sdPolygon(polygonVertices, p.xy + 0.5 * scaler + vec2(0.0, 0.25*scaler)); // Shift the polygon downwards
    vec2 w = vec2( d, abs(p.z) - h );
    return min(max(w.x,w.y),0.0) + length(max(w,0.0)) - 0.1;
}


float object_selector(vec3 p) {
    // return object5(p);
    int object_id = u_touchCount % 5; // Cycle through 5 objects based on touch count

    if (object_id == 0) return object1(p);
    if (object_id == 1) return object2(p);
    if (object_id == 2) return object3(p);
    if (object_id == 3) return object4(p);
    if (object_id == 4) return object5(p);

    return object1(p); // Default to object1 if none match

}

vec3 getTransformedPos(vec3 rayPos) {
    return rotate(rayPos - u_objectPosition, u_objectRotation) / u_objectScale;;
}
vec3 getRotate1Pos(vec3 rayPos) {
    return rotate(rayPos, vec3(sin(u_time*0.15), sin(u_time*0.05 ), cos(0.1*u_time + 2.0)));
}
float rotate1(vec3 rayPos) {
    return sdTorus(getRotate1Pos(rayPos), vec2(2.2, 0.2));
}
float rotate2(vec3 rayPos) {
    return 1e10;
    // return sdTorus(rotate(rayPos, vec3(sin(u_time*0.5), sin(u_time*0.2), cos(0.3*u_time))), vec2(7.0, 1.3));
}


float getDist(vec3 rayPos) {
    vec3 p = getTransformedPos(rayPos);

    float d = object_selector(p) * u_objectScale;
    // float d = 1e10;

    // rotate 1
    float r1 = rotate1(rayPos);
    d = min(d, r1);

    // rotate 2
    float r2 = rotate2(rayPos);
    d = min(d, r2);

    return d;
}

int getMaterial(vec3 rayPos) {
    // return 2; // Single object.
    // Compare the distance to return matching material if needed

    float d = object_selector(getTransformedPos(rayPos)) * u_objectScale;
    float r1 = rotate1(rayPos);
    float r2 = rotate2(rayPos);

    if (d < r1 && d < r2) {
        return 0; // Object material
    } else if (r1 < d && r1 < r2) {
        return 1; // Rotate 1 material
    } else if (r2 < d && r2 < r1) {
        return 2; // Rotate 2 material
    }
    return 0; // No material
}

vec3 getNormal(vec3 rayPos) {
    const vec2 k = vec2(1, -1);

    vec3 norm = k.xyy * getDist(rayPos + k.xyy*u_eps) +
                k.yxy * getDist(rayPos + k.yxy*u_eps) +
                k.xxx * getDist(rayPos + k.xxx*u_eps) +
                k.yyx * getDist(rayPos + k.yyx*u_eps);
                
    return normalize(norm);
}

vec3 surfaceNoise(float scale, vec3 p, vec3 n, sampler2D normalMapSampler) {
    // vec3 p = getTransformedPos(rayPos);
    vec3 an = abs(n);
    vec2 uv1 = vec2(0.0);
    vec2 uv2 = vec2(0.0);
    vec2 weights = vec2(0.0);

    // Biplanar mapping for noise texture
    // Pick the two dominant axes
    if (an.x > an.y && an.x > an.z) {
        uv1 = p.yz * scale; uv2 = (an.y > an.z) ? p.xz * scale : p.xy * scale;
        weights = vec2(an.x, max(an.y, an.z));
    } else if (an.y > an.z) {
        uv1 = p.xz * scale; uv2 = (an.x > an.z) ? p.yz * scale : p.xy * scale;
        weights = vec2(an.y, max(an.x, an.z));
    } else {
        uv1 = p.xy * scale; uv2 = (an.x > an.y) ? p.yz * scale : p.xz * scale;
        weights = vec2(an.z, max(an.x, an.y));
    }

    weights /= (weights.x + weights.y);
    

    // static noise
    float noise = hash33(p * 10.0).x * 0.00; // Adjust the multiplier for more or less noise

    return texture(normalMapSampler, uv1).rgb * weights.x + texture(normalMapSampler, uv2).rgb * weights.y + noise;

}


vec4 render(vec3 u_cameraPos, vec3 cameraRay, float IOR) {
    vec3 rayPos = u_cameraPos;
    vec3 rayDir = cameraRay;
    float totalDistance = 0.0;

    bool isHitmaterial2 = false;

    for (int i = 0; i < 256; i++) {
        float distance = getDist(rayPos);
        float absDistance = abs(distance);

        totalDistance += absDistance;

        // Hits the face
        if (abs(distance) < .001) {
            vec3 normal = getNormal(rayPos);

            int material = getMaterial(rayPos);
            vec3 p = getTransformedPos(rayPos);

            if (material == 0) {
                normal += surfaceNoise(0.09, p, normal, u_normalMapSampler) * 0.35;
            } else if (material == 1) {
                normal += surfaceNoise(0.5, getRotate1Pos(rayPos), normal, u_roughNormalMapSampler) * 0.7; // Add some noise to the normal
                // normal += hash33(getTransformedPos(rayPos)) * 0.3; // Add some noise to the normal
                isHitmaterial2 = true; // Mark that we hit material 2
            } else if (material == 2) {
                // normal += hash33(getTransformedPos(rayPos)) * 0.1; // Add some noise to the normal
                normal += surfaceNoise(0.09, p, normal, u_normalMapSampler) * 1.0;

                // Diffusive element
                // return vec4(normal, 3.0); // Black color for diffusive element
            }

            normal = normalize(normal);

            
            if (out_normal.a == 0.0) {  // Only for the first hit
                out_depth = (totalDistance-3.0)*0.4; 
                out_normal = vec4(normalize(normal + rayPos), dot(normal, cameraRay)); // Store the normal and the dot product with the camera ray
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


        if (totalDistance > 30.0) {
            break;
        }
    }

    float R = 30.0; // Sphere radius
    float pd = dot(rayPos, rayDir);
    float k = -pd + sqrt(pd*pd - length(rayPos)*length(rayPos) + R*R);
    return vec4(normalize(rayDir*k+rayPos), isHitmaterial2 ? 2.0 : 1.0); // Return the ray direction and a flag for hitting rotate1
}

void main() {
    vec3 reference = normalize(u_pointing - u_cameraPos);

    vec3 horizontal = cross(reference, vec3(0.0, 0.0, 1.0)); // z vector is up
    vec3 vertical = cross(horizontal, reference);

    horizontal = normalize(horizontal) * tan(radians(u_fov) / 2.0);
    vertical = normalize(vertical) * tan(radians(u_fov) / 2.0) / u_aspectRatio;

    vec3 cameraRay = normalize(reference + (uv.x - 0.5) * 2.0 * horizontal + (uv.y - 0.5) * 2.0 * vertical);

    out_normal = vec4(0.0);
    out_depth  = 30.0;

    out_rayDir = render(u_cameraPos, cameraRay, u_IOR); // For high IOR
    // out_rayDir_low = render(u_cameraPos, cameraRay, u_lowIOR); // For low IOR

    // Regularization for just look
    out_depth = log(out_depth + 1.0) / 2.7 / 3.0; // Normalize depth to [0, 1] range

}
