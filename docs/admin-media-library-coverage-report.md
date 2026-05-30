# Admin Media Library Coverage Report

## Summary

The admin media library now lists site-used images from database records, protected site references, and uploaded files. It distinguishes between deletable uploads and images that are currently in use by projects or site settings.

## Sources Covered

| Source | Included | Source label |
| --- | --- | --- |
| `ak_project_images` rows | Yes | `Project gallery` |
| `ak_projects.cover_image_url` | Yes | `Project cover` |
| Image-like `ak_site_settings` fields | Yes, when the value looks like an image URL/path | `Site setting` |
| `/uploads/project-images/` files | Yes | `Uploaded file` |
| `public/assets` or public uploaded paths referenced by settings | Yes, when stored in an image-like site setting field | `Site setting` |

Image-like site setting fields are detected by column names such as `image`, `logo`, `favicon`, `og_`, `photo`, `picture`, `hero`, `home`, `homepage`, and `about`, and values are included only when they look like image references.

## De-duplication

The API de-duplicates images by normalized URL/path. If the same image is both a gallery upload and a protected reference, the resulting media card is protected.

## Protected Images

Protected images include:

- Project cover images.
- Site setting images such as logo, favicon, homepage/about/hero image fields when present.

Protected cards:

- Show a `Kullanımda` badge.
- Show the tooltip `Bu görsel önce ilgili ayardan/projeden kaldırılmalı`.
- Do not show a delete button.
- Are blocked server-side with HTTP `409` if a delete request targets their path or DB row.

## Deletable Images

Normal uploaded images remain deletable when they are not referenced as a project cover or site setting image.

Delete behavior:

- `DELETE /api/admin/media.php?id=...` deletes the gallery DB row and, when safe, the matching `/uploads/project-images/...` file.
- `DELETE /api/admin/media.php?path=...` deletes a safe uploaded file path and any matching gallery DB row.
- Only safe `/uploads/project-images/*.{jpg,jpeg,png,webp,gif}` paths are eligible for filesystem deletion.

## UI Changes

- Media cards show image preview, filename, source label, copy URL button, and delete button only for deletable images.
- Protected cards show `Kullanımda` with an explanatory tooltip.
- Search still covers filename, URL, project title, alt text, title, and source label.

## Validation

- `npm run build` should be run after this change.
- PHP lint could not be run locally unless PHP is installed in the shell.
