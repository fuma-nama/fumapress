import type { APIRoute, GetStaticPaths, InferGetStaticPropsType } from "astro";
import { adapter, staticNotFound } from "virtual:fumapress/astro";
import { ctx } from "./context";
import { fileStaticPaths } from "./shared";

export const getStaticPaths = (() =>
  fileStaticPaths(ctx, adapter, staticNotFound)) satisfies GetStaticPaths;

export const GET: APIRoute<InferGetStaticPropsType<typeof getStaticPaths>> = ({ props, request }) =>
  props.GET(request, { params: props.params });
