//! The frame that draws an agent's ```visual block, served by the
//! `monocode-viz` scheme with its own CSP. In debug builds every file is read
//! from disk on each request, so editing the kit needs no rebuild.

use std::borrow::Cow;
#[cfg(debug_assertions)]
use std::path::PathBuf;
use tauri::http::{header, Request, Response, StatusCode};

pub const SCHEME: &str = "monocode-viz";

const CSP: &str = "default-src 'none'; \
script-src 'unsafe-inline' monocode-viz: http://monocode-viz.localhost https://monocode-viz.localhost; \
style-src 'unsafe-inline' monocode-viz: http://monocode-viz.localhost https://monocode-viz.localhost; \
img-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'";

const HTML: &str = "text/html; charset=utf-8";
const JS: &str = "text/javascript; charset=utf-8";
const CSS: &str = "text/css; charset=utf-8";

/// The files the frame may load, each named once: debug builds read them from
/// disk, release builds carry them in the binary.
macro_rules! kit_files {
    ($($name:literal => $kind:expr),* $(,)?) => {
        const FILES: &[(&str, &str)] = &[$(($name, $kind)),*];

        #[cfg(not(debug_assertions))]
        fn embedded(name: &str) -> Option<&'static [u8]> {
            match name {
                $($name => Some(include_bytes!(concat!("../visual/", $name))),)*
                _ => None,
            }
        }
    };
}

kit_files! {
    "frame.html" => HTML,
    "bx.js" => JS,
    "bx-pieces.js" => JS,
    "bx.css" => CSS,
    "bx-pieces.css" => CSS,
    "echarts-6.1.0.min.js" => JS,
}

fn content_type(name: &str) -> Option<&'static str> {
    FILES
        .iter()
        .find(|(file, _)| *file == name)
        .map(|(_, kind)| *kind)
}

#[cfg(debug_assertions)]
fn file_bytes(name: &str) -> Option<Cow<'static, [u8]>> {
    let dir = PathBuf::from(concat!(env!("CARGO_MANIFEST_DIR"), "/visual"));
    std::fs::read(dir.join(name)).ok().map(Cow::Owned)
}

#[cfg(not(debug_assertions))]
fn file_bytes(name: &str) -> Option<Cow<'static, [u8]>> {
    embedded(name).map(Cow::Borrowed)
}

/// The response for a request path such as `/frame.html`. Anything outside
/// the kit's files is a 404.
fn respond(path: &str) -> Response<Cow<'static, [u8]>> {
    let name = path.trim_start_matches('/');
    // Only a known kit file is ever read; anything else never touches disk.
    let found = match content_type(name) {
        Some(kind) => file_bytes(name).map(|bytes| (kind, bytes)),
        None => None,
    };
    let builder = Response::builder()
        .header(header::CONTENT_SECURITY_POLICY, CSP)
        .header("X-Content-Type-Options", "nosniff")
        // Served from memory, so caching saves nothing, and a cached kit
        // would outlive an app update or an edit in development.
        .header(header::CACHE_CONTROL, "no-store");
    match found {
        Some((kind, bytes)) => builder
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, kind)
            .body(bytes),
        None => builder
            .status(StatusCode::NOT_FOUND)
            .body(Cow::Borrowed(&[][..])),
    }
    .expect("static response parts are valid")
}

pub fn handle(request: Request<Vec<u8>>) -> Response<Cow<'static, [u8]>> {
    respond(request.uri().path())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serves_only_the_kit_files() {
        for (file, _) in FILES {
            assert_eq!(
                respond(&format!("/{file}")).status(),
                StatusCode::OK,
                "{file}"
            );
        }
        assert_eq!(respond("/secret.txt").status(), StatusCode::NOT_FOUND);
        assert_eq!(respond("/../Cargo.toml").status(), StatusCode::NOT_FOUND);
    }

    #[test]
    fn every_response_carries_the_frame_csp() {
        for path in ["/frame.html", "/missing"] {
            let response = respond(path);
            let csp = response
                .headers()
                .get(header::CONTENT_SECURITY_POLICY)
                .and_then(|value| value.to_str().ok())
                .unwrap_or_default();
            assert!(csp.contains("connect-src 'none'"), "{path}: {csp}");
            assert!(csp.starts_with("default-src 'none'"), "{path}: {csp}");
        }
    }
}
