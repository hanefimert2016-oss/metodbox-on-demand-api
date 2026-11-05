MIRAS Türkiye Stories — Cloudflare deployment

Same original MagicPath React UI, 28 filmed videos and community Worker copied from Metodbox-secret-system/frame-android-app.

Deployment branch: miras-workers-20261105. Worker name: miras-turkiye-stories. Original Metodbox main branch and production Worker are not modified.

Actions uses repository Cloudflare credentials CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID. It builds React, tests MİRAS, deploys Worker and checks the public address.

For real accounts/uploads/likes/comments, additional GitHub Actions secrets MIRAS_GITHUB_TOKEN (Contents read/write on original video storage repository) and MIRAS_SESSION_SECRET must be set. If absent, curated catalog works but community_enabled is false. GitHub uploads remain on original Metodbox-secret-system/frame-video-storage branch.
