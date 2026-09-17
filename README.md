# Flange Torque Report Builder

A standalone web tool (no Claude account needed) that lets your crew snap a
photo of a Stranco field torque tag (or upload a PDF of one), reads the
handwriting automatically, checks it against your QC standards, and
produces a printable Flange Torque Report PDF on your existing template.

## What's inside

- `app/` -- the Python (FastAPI) backend. It calls the Anthropic API to
  read the tag photos, fills in your `template.xltx`, and uses LibreOffice
  (headless) to convert it to a PDF that matches the original layout
  exactly.
- `static/` -- the web page your crew opens on their phones.
- `Dockerfile` -- packages everything (including LibreOffice) so it can be
  deployed anywhere that runs Docker containers.

## What you need before deploying

**An Anthropic API key.** This is what actually reads the handwriting --
it's separate from your claude.ai account. Get one at
[console.anthropic.com](https://console.anthropic.com):

1. Sign up / log in, go to **Settings -> Billing** and add a payment
   method (there's no monthly fee -- you're billed only for what you use).
2. Go to **Settings -> API Keys -> Create Key**. Copy the key (starts with
   `sk-ant-...`) -- you'll paste it into your hosting provider in step 3
   below, never into the app's code.

**Real-world cost**: with Claude Sonnet, reading one photo (even one with
6-8 tags on it, like your scanned sheets) runs about $0.01-0.02 per photo,
not per tag -- so a batch of 2,000 tags shot a handful at a time is more
likely to land somewhere around $5-15 total, not $60. Cost scales with
how many tags you fit in one photo and how much handwriting there is to
read, so treat this as an estimate and watch your usage dashboard for the
first week to see your own actual rate.

## Deploying (Render.com, free to start)

1. Create a free account at [render.com](https://render.com).
2. Put this project in a GitHub repository (create a new repo on
   [github.com](https://github.com/new), then follow GitHub's "upload
   existing files" flow to drag this whole folder in -- no command line
   needed).
3. In Render, click **New -> Web Service**, connect that GitHub repo, and
   choose:
   - **Environment**: Docker (Render will detect the `Dockerfile`
     automatically)
   - **Instance type**: Free is fine to start; upgrade later if your crew
     is hammering it and it feels slow.
4. Under **Environment Variables**, add one:
   - Key: `ANTHROPIC_API_KEY`
   - Value: the `sk-ant-...` key from above
5. Click **Create Web Service**. First build takes a few minutes (it's
   installing LibreOffice). When it's done, Render gives you a URL like
   `https://flange-torque-builder.onrender.com` -- that's the link you
   share with your crew (text it, put it in a QR code on the truck, etc).

Free-tier Render services "sleep" after 15 minutes of no traffic and take
~30-60 seconds to wake back up on the next visit -- fine for occasional
field use. If that's annoying, a $7/mo Starter instance keeps it always on.

**Railway.app** works the same way if you'd rather use that instead --
same Dockerfile, same env var, no code changes needed.

## Using it

- Open the link on a phone -> **Upload Tag Photo** -> take a picture or
  pick a file (or upload a PDF of scanned tags) -> **Read Tags**.
- Each tag it finds shows up as an editable card -- anything it wasn't
  sure about is flagged with a warning, and anything that doesn't match
  your QC Standards table (bolt size / torque for that flange size) is
  highlighted so it can be checked before it goes on the report.
- **Add to Report** for each tag you want included, then **Generate PDF
  Report** downloads one PDF with one page per flange, ready to print.
- **QC Standards** and **Job Info** panels are editable and remembered on
  that phone/browser between visits.

## Keeping it in sync with changes

If you ever want a field changed (a new default, a different QC rule, a
tweak to the layout), the easiest path is to come back to Claude, describe
the change, and get an updated copy of this project to re-upload to the
same GitHub repo -- Render redeploys automatically within a minute or two
of a new upload.
