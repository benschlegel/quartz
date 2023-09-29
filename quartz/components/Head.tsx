import { FullSlug, _stripSlashes, joinSegments, pathToRoot } from "../util/path"
import { JSResourceToScriptElement } from "../util/resources"
import { QuartzComponentConstructor, QuartzComponentProps } from "./types"
import satori, { SatoriOptions } from "satori"
import * as fs from "fs"
import { ImageOptions, getSatoriFont } from "../util/imageHelper"
import sharp from "sharp"
import { defaultImage } from "../util/defaultImage"
import { JSXInternal } from "preact/src/jsx"
import { unescapeHTML } from "../util/escape"

/**
 * Generates social image (OG/twitter standard) and saves it as `.web` inside the public folder
 * @param opts options for generating image
 */
async function generateSocialImage(opts: ImageOptions) {
  const { cfg, description, fileName, fontsPromise, title, imageHtml } = opts
  const fonts = await fontsPromise

  const defaultImg = defaultImage(cfg, title, description, fonts)

  // If imageHtml was passed, use it. otherwise, use default image element
  let imageElement: JSXInternal.Element = defaultImg
  if (imageHtml) {
    imageElement = imageHtml(cfg, title, description, fonts)
  }

  const svg = await satori(imageElement, {
    width: ogHeight,
    height: ogWidth,
    fonts: fonts,
  })

  // Convert svg directly to webp (with additional compression)
  const compressed = await sharp(Buffer.from(svg)).webp({ quality: 40 }).toBuffer()

  // Write to file system
  fs.writeFileSync(`${imageDir}/${fileName}.${extension}`, compressed)
}

// TODO: mention `description` plugin in docs for max length
// TODO: add to config and use in generateSocialImage
// Social image defaults
const ogHeight = 1200
const ogWidth = 676
const extension = "webp"
const imageDir = "public/static/social-images"

export default (() => {
  let fontsPromise: Promise<SatoriOptions["fonts"]>
  function Head({ cfg, fileData, externalResources }: QuartzComponentProps) {
    if (!fontsPromise) {
      fontsPromise = getSatoriFont(cfg.theme.typography.header, cfg.theme.typography.body)
    }
    const slug = fileData.filePath
    // since "/" is not a valid character in file names, replace with "-"
    const fileName = slug?.replaceAll("/", "-")
    const title = fileData.frontmatter?.title ?? "Untitled"

    // Get file description (priority: frontmatter > fileData > default)
    const fdDescription = fileData.description?.trim()
    let description = ""
    if (fdDescription) {
      description = unescapeHTML(fdDescription)
    }
    if (fileData.frontmatter?.socialDescription) {
      description = fileData.frontmatter.socialDescription
    }

    if (cfg.generateSocialImages) {
      // Generate folders for social images (if they dont exist yet)
      if (!fs.existsSync(imageDir)) {
        fs.mkdirSync(imageDir, { recursive: true })
      }

      if (fileName) {
        // Generate social image (happens async)
        generateSocialImage({
          title,
          description,
          fileName,
          fileDir: imageDir,
          imgHeight: ogHeight,
          imgWidth: ogWidth,
          fileExt: extension,
          fontsPromise,
          cfg,
        })
      }
    }

    const { css, js } = externalResources

    const url = new URL(`https://${cfg.baseUrl ?? "example.com"}`)
    const path = url.pathname as FullSlug
    const baseDir = fileData.slug === "404" ? path : pathToRoot(fileData.slug!)

    const iconPath = joinSegments(baseDir, "static/icon.png")

    const ogImageDefaultPath = `https://${cfg.baseUrl}/static/og-image.png`
    const ogImageGeneratedPath = `https://${cfg.baseUrl}/${imageDir.replace(
      "public/",
      "",
    )}/${fileName}.${extension}`

    // Use default og image if filePath doesnt exist (for autogenerated paths with no .md file)
    const useDefaultOgImage = fileName === undefined || !cfg.generateSocialImages

    // Path to og/social image (priority: frontmatter > generated image (if enabled) > default image)
    let ogImagePath = useDefaultOgImage ? ogImageDefaultPath : ogImageGeneratedPath

    const frontmatterImgUrl = fileData.frontmatter?.socialImageUrl
    if (frontmatterImgUrl) {
      ogImagePath = `https://${cfg.baseUrl}/static/${frontmatterImgUrl}`
    }

    return (
      <head>
        <title>{title}</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {/* OG/Twitter meta tags */}
        <meta name="og:site_name" content={cfg.pageTitle}></meta>
        <meta property="og:title" content={title} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta property="og:description" content={description} />
        <meta property="og:image:type" content={`image/${extension}`} />
        <meta property="og:image:alt" content={description} />
        {/* Dont set width and height if unknown (when using custom frontmatter image) */}
        {!frontmatterImgUrl && (
          <>
            <meta property="og:image:width" content={ogWidth.toString()} />
            <meta property="og:image:height" content={ogHeight.toString()} />
            <meta property="og:width" content={ogWidth.toString()} />
            <meta property="og:height" content={ogHeight.toString()} />
          </>
        )}
        <meta property="og:image:url" content={ogImagePath} />
        {cfg.baseUrl && (
          <>
            <meta name="twitter:image" content={ogImagePath} />
            <meta property="og:image" content={ogImagePath} />
            <meta property="twitter:domain" content={cfg.baseUrl}></meta>
            <meta property="og:url" content={`https://${cfg.baseUrl}/${fileData.slug}`}></meta>
            <meta property="twitter:url" content={`https://${cfg.baseUrl}/${fileData.slug}`}></meta>
          </>
        )}
        <link rel="icon" href={iconPath} />
        <meta name="description" content={description} />
        <meta name="generator" content="Quartz" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" />
        {css.map((href) => (
          <link key={href} href={href} rel="stylesheet" type="text/css" spa-preserve />
        ))}
        {js
          .filter((resource) => resource.loadTime === "beforeDOMReady")
          .map((res) => JSResourceToScriptElement(res, true))}
      </head>
    )
  }

  return Head
}) satisfies QuartzComponentConstructor
